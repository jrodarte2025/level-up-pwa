/* eslint-disable no-undef */

/****
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Load environment variables from .env file
require('dotenv').config();

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

setGlobalOptions({ maxInstances: 10 });

const admin = require("firebase-admin");

// Initialize admin SDK differently for emulator vs production
if (process.env.FUNCTIONS_EMULATOR === "true") {
  // For local emulator, use default credentials
  admin.initializeApp({
    projectId: "level-up-app-c9f47"
  });
} else {
  // For production, use default app initialization
  admin.initializeApp();
}

exports.sendTestPush = onRequest(
  { memory: "256MB", timeoutSeconds: 60 },
  async (req, res) => {
    try {
      const tokenSnapshot = await admin.firestore().collection("notification_tokens").get();
      const tokenDocs = tokenSnapshot.docs.filter(doc => {
        const token = doc.data()?.token;
        return typeof token === 'string' && token.length > 0;
      });

      if (tokenDocs.length === 0) {
        res.status(404).send("No notification tokens found.");
        return;
      }

      const tokens = tokenDocs.map(doc => doc.data().token);
      const message = {
        notification: {
          title: "🔔 Level Up Test",
          body: "This is a test push from Firebase Functions!"
        },
        tokens: tokens
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info("Push sent:", response);
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        const tokensToDelete = [];
        const batch = admin.firestore().batch();
        
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            const tokenDocId = tokenDocs[idx].id;
            
            logger.warn(`Failed to send to token ${tokens[idx].substring(0, 10)}...`, {
              errorCode,
              errorMessage: resp.error?.message
            });
            
            // Remove invalid/unregistered tokens
            if (errorCode === 'messaging/registration-token-not-registered' ||
                errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/invalid-argument') {
              tokensToDelete.push(tokenDocId);
              batch.delete(admin.firestore().collection("notification_tokens").doc(tokenDocId));
              logger.info(`Queued deletion of invalid token: ${tokenDocId}`);
            }
          }
        });
        
        // Execute batch deletion if there are tokens to delete
        if (tokensToDelete.length > 0) {
          await batch.commit();
          logger.info(`Cleaned up ${tokensToDelete.length} invalid FCM tokens from Firestore`);
        }
      }
      
      res.status(200).send(`Push sent to ${response.successCount} devices. ${response.failureCount > 0 ? `Failed: ${response.failureCount}` : ''}`);
    } catch (error) {
      logger.error("Error sending push:", error);
      res.status(500).send("Error sending notification.");
    }
  }
);


exports.sendUpdateNotification = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data();
  const visibleTo = post?.visibleTo || [];

  logger.info(`New post created: ${post?.title}`);
  logger.info(`Target audience (visibleTo): ${JSON.stringify(visibleTo)}`);

  // If no audience specified, don't send notifications
  if (visibleTo.length === 0) {
    logger.warn("Post has no target audience (visibleTo is empty). Skipping notifications.");
    return;
  }

  // Helper function to check if a user's role matches the visibleTo array
  const roleMatches = (userRole, visibleTo) => {
    if (!userRole) return false;

    // Direct match
    if (visibleTo.includes(userRole)) return true;

    // Handle composite roles
    if (userRole === "coach-board") {
      return visibleTo.includes("coach") || visibleTo.includes("board");
    }
    if (userRole === "future-coach") {
      return visibleTo.includes("coach");
    }

    return false;
  };

  // Get all users and filter by role
  const usersSnapshot = await admin.firestore().collection("users").get();
  const targetUserIds = usersSnapshot.docs
    .filter(doc => roleMatches(doc.data()?.role, visibleTo))
    .map(doc => doc.id);

  logger.info(`Found ${targetUserIds.length} users with matching roles out of ${usersSnapshot.size} total users`);

  if (targetUserIds.length === 0) {
    logger.info(`No users found matching roles: ${visibleTo.join(', ')}`);
    return;
  }

  // Get notification tokens only for target users
  const tokensSnapshot = await admin.firestore().collection("notification_tokens").get();
  const tokenDocs = tokensSnapshot.docs.filter(doc => {
    const token = doc.data()?.token;
    const userId = doc.id;
    const isTargetUser = targetUserIds.includes(userId);
    const hasValidToken = typeof token === 'string' && token.length > 0;
    return isTargetUser && hasValidToken;
  });

  if (tokenDocs.length === 0) {
    logger.info("No notification tokens available for target users");
    return;
  }

  const tokens = tokenDocs.map(doc => doc.data().token);
  logger.info(`Sending notifications to ${tokens.length} devices (filtered by role)`);

  const message = {
    notification: {
      title: `📢 New Update: ${post.title}`,
      body: "Open the app to read more"
    },
    tokens
  };

  logger.info("Sending update notification to filtered audience");

  try {
    const messaging = admin.messaging();
    const response = await messaging.sendEachForMulticast(message);
    logger.info("Update push response:", {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // Handle failed tokens
    if (response.failureCount > 0) {
      const tokensToDelete = [];
      const batch = admin.firestore().batch();

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          const token = tokens[idx];
          const tokenDocId = tokenDocs[idx].id;

          logger.warn(`Failed to send to token ${token.substring(0, 10)}...`, {
            errorCode,
            errorMessage: resp.error?.message
          });

          // Remove invalid/unregistered tokens
          if (errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/invalid-argument') {
            tokensToDelete.push(tokenDocId);
            batch.delete(admin.firestore().collection("notification_tokens").doc(tokenDocId));
            logger.info(`Queued deletion of invalid token: ${tokenDocId}`);
          }
        }
      });

      // Execute batch deletion if there are tokens to delete
      if (tokensToDelete.length > 0) {
        await batch.commit();
        logger.info(`Cleaned up ${tokensToDelete.length} invalid FCM tokens from Firestore`);
      }
    }

    return response;
  } catch (error) {
    logger.error("Error sending update notification:", error);
    // Don't throw - let the function complete successfully even if notifications fail
  }
});

exports.sendEventNotification = onDocumentCreated('events/{eventId}', async (event) => {
  const eventData = event.data?.data();
  const eventGroups = eventData?.groups || [];
  const eventStatus = eventData?.status;

  logger.info(`New event created: ${eventData?.name}`);
  logger.info(`Event status: ${eventStatus}`);
  logger.info(`Target groups: ${JSON.stringify(eventGroups)}`);

  // Skip notifications for draft events
  // Only send if status is "published" or not set (backwards compatibility)
  if (eventStatus === "draft") {
    logger.info("Event is a draft. Skipping notifications.");
    return;
  }

  // If no groups specified, don't send notifications
  if (eventGroups.length === 0) {
    logger.warn("Event has no target groups. Skipping notifications.");
    return;
  }

  // Convert event groups ("coaches", "students") to user roles ("coach", "student")
  // and handle composite roles
  const roleMatches = (userRole, eventGroups) => {
    if (!userRole) return false;

    // Map event groups to roles
    const hasCoaches = eventGroups.includes("coaches");
    const hasStudents = eventGroups.includes("students");

    // Direct role matches
    if (userRole === "coach" && hasCoaches) return true;
    if (userRole === "student" && hasStudents) return true;
    if (userRole === "board" && hasCoaches) return true; // Boards typically attend coach events

    // Composite roles
    if (userRole === "coach-board") {
      return hasCoaches; // Coach-board users get coach events
    }
    if (userRole === "future-coach") {
      return hasCoaches; // Future coaches get coach events
    }

    return false;
  };

  // Get all users and filter by role
  const usersSnapshot = await admin.firestore().collection("users").get();
  const targetUserIds = usersSnapshot.docs
    .filter(doc => roleMatches(doc.data()?.role, eventGroups))
    .map(doc => doc.id);

  logger.info(`Found ${targetUserIds.length} users with matching roles out of ${usersSnapshot.size} total users`);

  if (targetUserIds.length === 0) {
    logger.info(`No users found matching groups: ${eventGroups.join(', ')}`);
    return;
  }

  // Get notification tokens only for target users
  const tokensSnapshot = await admin.firestore().collection("notification_tokens").get();
  const tokenDocs = tokensSnapshot.docs.filter(doc => {
    const token = doc.data()?.token;
    const userId = doc.id;
    const isTargetUser = targetUserIds.includes(userId);
    const hasValidToken = typeof token === 'string' && token.length > 0;
    return isTargetUser && hasValidToken;
  });

  if (tokenDocs.length === 0) {
    logger.info("No notification tokens available for target users");
    return;
  }

  const tokens = tokenDocs.map(doc => doc.data().token);
  logger.info(`Sending notifications to ${tokens.length} devices (filtered by group)`);

  const message = {
    notification: {
      title: `📅 Event Added: ${eventData.name}`,
      body: "Tap to view the event details"
    },
    tokens
  };

  logger.info("Sending event notification to filtered audience");

  try {
    const messaging = admin.messaging();
    const response = await messaging.sendEachForMulticast(message);
    logger.info("Event push response:", {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // Handle failed tokens
    if (response.failureCount > 0) {
      const tokensToDelete = [];
      const batch = admin.firestore().batch();

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          const token = tokens[idx];
          const tokenDocId = tokenDocs[idx].id;

          logger.warn(`Failed to send to token ${token.substring(0, 10)}...`, {
            errorCode,
            errorMessage: resp.error?.message
          });

          // Remove invalid/unregistered tokens
          if (errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/invalid-argument') {
            tokensToDelete.push(tokenDocId);
            batch.delete(admin.firestore().collection("notification_tokens").doc(tokenDocId));
            logger.info(`Queued deletion of invalid token: ${tokenDocId}`);
          }
        }
      });

      // Execute batch deletion if there are tokens to delete
      if (tokensToDelete.length > 0) {
        await batch.commit();
        logger.info(`Cleaned up ${tokensToDelete.length} invalid FCM tokens from Firestore`);
      }
    }

    return response;
  } catch (error) {
    logger.error("Error sending event notification:", error);
    // Don't throw - let the function complete successfully even if notifications fail
  }
});

// Send notification when a draft event is published
exports.sendEventPublishedNotification = onDocumentUpdated('events/{eventId}', async (event) => {
  const beforeData = event.data?.before?.data();
  const afterData = event.data?.after?.data();

  // Only trigger if status changed from "draft" to "published"
  const wasDraft = beforeData?.status === "draft";
  const isNowPublished = afterData?.status === "published";

  if (!wasDraft || !isNowPublished) {
    // Not a draft->published transition, skip
    return;
  }

  logger.info(`Event published: ${afterData?.name}`);

  const eventGroups = afterData?.groups || [];

  if (eventGroups.length === 0) {
    logger.warn("Published event has no target groups. Skipping notifications.");
    return;
  }

  // Convert event groups ("coaches", "students") to user roles ("coach", "student")
  const roleMatches = (userRole, eventGroups) => {
    if (!userRole) return false;

    const hasCoaches = eventGroups.includes("coaches");
    const hasStudents = eventGroups.includes("students");

    if (userRole === "coach" && hasCoaches) return true;
    if (userRole === "student" && hasStudents) return true;
    if (userRole === "board" && hasCoaches) return true;

    if (userRole === "coach-board") {
      return hasCoaches;
    }
    if (userRole === "future-coach") {
      return hasCoaches;
    }

    return false;
  };

  // Get all users and filter by role
  const usersSnapshot = await admin.firestore().collection("users").get();
  const targetUserIds = usersSnapshot.docs
    .filter(doc => roleMatches(doc.data()?.role, eventGroups))
    .map(doc => doc.id);

  logger.info(`Found ${targetUserIds.length} users with matching roles`);

  if (targetUserIds.length === 0) {
    logger.info(`No users found matching groups: ${eventGroups.join(', ')}`);
    return;
  }

  // Get notification tokens only for target users
  const tokensSnapshot = await admin.firestore().collection("notification_tokens").get();
  const tokenDocs = tokensSnapshot.docs.filter(doc => {
    const token = doc.data()?.token;
    const userId = doc.id;
    const isTargetUser = targetUserIds.includes(userId);
    const hasValidToken = typeof token === 'string' && token.length > 0;
    return isTargetUser && hasValidToken;
  });

  if (tokenDocs.length === 0) {
    logger.info("No notification tokens available for target users");
    return;
  }

  const tokens = tokenDocs.map(doc => doc.data().token);
  logger.info(`Sending notifications to ${tokens.length} devices`);

  const message = {
    notification: {
      title: `📅 Event Added: ${afterData.name}`,
      body: "Tap to view the event details"
    },
    tokens
  };

  try {
    const messaging = admin.messaging();
    const response = await messaging.sendEachForMulticast(message);
    logger.info("Event published notification response:", {
      successCount: response.successCount,
      failureCount: response.failureCount
    });

    // Handle failed tokens
    if (response.failureCount > 0) {
      const tokensToDelete = [];
      const batch = admin.firestore().batch();

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          const tokenDocId = tokenDocs[idx].id;

          if (errorCode === 'messaging/registration-token-not-registered' ||
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/invalid-argument') {
            tokensToDelete.push(tokenDocId);
            batch.delete(admin.firestore().collection("notification_tokens").doc(tokenDocId));
          }
        }
      });

      if (tokensToDelete.length > 0) {
        await batch.commit();
        logger.info(`Cleaned up ${tokensToDelete.length} invalid FCM tokens`);
      }
    }

    return response;
  } catch (error) {
    logger.error("Error sending event published notification:", error);
  }
});

// Admin password reset function (using onRequest with manual auth for CORS compatibility)
exports.adminResetPassword = onRequest(
  { 
    memory: "256MB", 
    timeoutSeconds: 60,
    cors: true,
    invoker: "public"
  },
  async (req, res) => {
    // Handle CORS manually
    const allowedOrigins = [
      "http://localhost:5174",
      "http://localhost:5173", 
      "https://level-up-app-c9f47.firebaseapp.com",
      "https://level-up-app-c9f47.web.app",
      "https://app.levelupcincinnati.org"
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    logger.info('adminResetPassword function called', { 
      method: req.method,
      origin: origin,
      hasAuth: !!req.headers.authorization
    });
    
    // Verify Firebase Auth token manually
    let auth = null;
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header');
      }
      
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      auth = {
        uid: decodedToken.uid,
        token: decodedToken
      };
    } catch (error) {
      logger.error('Authentication failed:', error);
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    
    // Check if the requesting user is an admin (priority: custom claims > Firestore role)
    const adminUid = auth.uid;
    let isAdmin = false;
    
    // Check for admin access in production
    
    // Production checks
    if (!isAdmin) {
      // First check custom claims
      if (auth.token.admin === true || auth.token.role === 'admin') {
        isAdmin = true;
        logger.info(`Admin access granted via custom claims for ${auth.token.email}`);
      } else {
        // Fallback to Firestore role check for backwards compatibility
        try {
          const adminDoc = await admin.firestore().collection('users').doc(adminUid).get();
          if (adminDoc.exists) {
            const userData = adminDoc.data();
            isAdmin = userData.isAdmin === true || userData.role === 'admin';
            if (isAdmin) {
              logger.info(`Admin access granted via Firestore role for ${auth.token.email}`);
            }
          }
        } catch (firestoreError) {
          logger.error('Error checking Firestore admin role:', firestoreError);
        }
      }
    }
    
    if (!isAdmin) {
      logger.warn(`Non-admin user ${adminUid} (${auth.token.email}) attempted password reset`);
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    // Get the target user email and new password from request body
    const { userEmail, newPassword, generateResetLink } = req.body;
    
    if (!userEmail) {
      res.status(400).json({ error: 'userEmail is required' });
      return;
    }

    // Generate password reset link
    if (generateResetLink) {
      try {
        
        const resetLink = await admin.auth().generatePasswordResetLink(userEmail);
        
        // Log the admin action
        await admin.firestore().collection('admin_actions').add({
          action: 'password_reset_link',
          adminUid: adminUid,
          adminEmail: auth.token.email,
          targetEmail: userEmail,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Admin ${auth.token.email} generated reset link for ${userEmail}`);
        
        res.status(200).json({ 
          success: true, 
          resetLink: resetLink,
          message: 'Password reset link generated successfully' 
        });
        return;
      } catch (error) {
        logger.error('Error generating reset link:', error);
        if (error.code === 'auth/user-not-found') {
          res.status(404).json({ error: 'User not found' });
        } else {
          res.status(500).json({ error: 'Error generating reset link: ' + error.message });
        }
        return;
      }
    }

    // Direct password reset
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    try {
      
      // Get the user by email
      const userRecord = await admin.auth().getUserByEmail(userEmail);
      
      // Update the user's password
      await admin.auth().updateUser(userRecord.uid, {
        password: newPassword
      });

      // Log the admin action
      await admin.firestore().collection('admin_actions').add({
        action: 'password_reset',
        adminUid: adminUid,
        adminEmail: auth.token.email,
        targetUid: userRecord.uid,
        targetEmail: userEmail,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info(`Admin ${auth.token.email} reset password for ${userEmail}`);
      
      res.status(200).json({ 
        success: true, 
        message: 'Password reset successfully' 
      });
    } catch (error) {
      logger.error('Error resetting password:', error);
      if (error.code === 'auth/user-not-found') {
        res.status(404).json({ error: 'User not found' });
      } else {
        res.status(500).json({ error: 'Error resetting password: ' + error.message });
      }
    }
  }
);

// Enhanced getPhoto function for Salesforce integration
exports.getPhoto = functions.https.onRequest(async (req, res) => {
  // Enable CORS for Salesforce and other origins
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    // Get parameters from request
    const photoPath = req.query.path; // e.g., "users/UID/profile.jpg" or "headshots/coach_123.jpg"
    const userId = req.query.userId; // optional: for logging
    const userType = req.query.type; // optional: 'coach' or 'student' for fallback paths
    
    console.log('Photo request:', { path: photoPath, userId, userType });
    
    if (!photoPath) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing photo path parameter',
        example: 'Use: ?path=users/USER_ID/profile.jpg or ?path=headshots/coach_123.jpg'
      });
    }
    
    // Get Firebase Storage bucket
    const bucket = admin.storage().bucket();
    let file = bucket.file(photoPath);
    
    // Check if file exists
    let [exists] = await file.exists();
    
    // If file doesn't exist and we have userId/userType, try alternative paths
    if (!exists && userId && userType) {
      const alternativePaths = [
        `users/${userId}/profile.jpg`,
        `users/${userId}/profile.png`,
        `headshots/${userType.toLowerCase()}_${userId}.jpg`,
        `headshots/${userType.toLowerCase()}_${userId}.png`,
        `headshots/${userId}.jpg`,
        `headshots/${userId}.png`
      ];
      
      console.log('Primary path not found, trying alternatives:', alternativePaths);
      
      for (const altPath of alternativePaths) {
        file = bucket.file(altPath);
        [exists] = await file.exists();
        if (exists) {
          console.log('Found photo at alternative path:', altPath);
          break;
        }
      }
    }
    
    if (!exists) {
      console.log('Photo not found at any path:', photoPath);
      return res.status(404).json({ 
        success: false,
        error: 'Photo not found',
        path: photoPath,
        message: 'The requested photo does not exist in Firebase Storage',
        triedPaths: userId && userType ? [
          photoPath,
          `users/${userId}/profile.jpg`,
          `headshots/${userType.toLowerCase()}_${userId}.jpg`
        ] : [photoPath]
      });
    }
    
    // Use Firebase's public download URL
    const bucketName = bucket.name;
    const actualPath = file.name; // Use the actual found file path
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(actualPath)}?alt=media`;
    
    console.log('Generated public URL for:', actualPath);
    
    // Return the public URL with metadata
    res.json({ 
      success: true,
      url: publicUrl,
      type: 'public',
      path: actualPath,
      originalPath: photoPath,
      userId: userId || null,
      userType: userType || null
    });
    
  } catch (error) {
    console.error('Error getting photo:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
      details: 'Check function logs for more information'
    });
  }
});

// Optional: Function to list available photos for a user
exports.listUserPhotos = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const userId = req.query.userId;
    const userType = req.query.type; // 'coach' or 'student'
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }
    
    const bucket = admin.storage().bucket();
    
    // List files with prefix - adjust this path to match your storage structure
    const prefix = `headshots/${userType || 'user'}_${userId}`;
    const [files] = await bucket.getFiles({ prefix: prefix });
    
    const photoList = files.map(file => ({
      name: file.name,
      path: file.name,
      updated: file.metadata.updated
    }));
    
    res.json({
      success: true,
      photos: photoList,
      userId: userId
    });
    
  } catch (error) {
    console.error('Error listing photos:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Coaches function - for external website integration
exports.coaches = onRequest(
  {
    memory: "256MB",
    timeoutSeconds: 60,
    cors: true
  },
  async (req, res) => {
    try {
      // Get all users with role 'coach' or 'coach-board'
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .where('role', 'in', ['coach', 'coach-board'])
        .get();

      const coaches = [];

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        let headshotUrl = null;

        // Try to get profile image URL - check multiple possible locations
        try {
          const bucket = admin.storage().bucket();

          // Try different possible image paths
          const imagePaths = [
            `users/${doc.id}/profile.jpg`,
            `users/${doc.id}/profile.png`,
            `headshots/${doc.id}.jpg`,
            `headshots/${doc.id}.png`,
            `headshots/coach_${doc.id}.jpg`,
            `headshots/coach_${doc.id}.png`
          ];

          for (const imagePath of imagePaths) {
            const file = bucket.file(imagePath);
            const [exists] = await file.exists();

            if (exists) {
              // Generate a public URL that doesn't expire
              const bucketName = bucket.name;
              headshotUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(imagePath)}?alt=media`;
              logger.info(`Found image for coach ${doc.id} at ${imagePath}`);
              break;
            }
          }

          if (!headshotUrl) {
            logger.info(`No image found for coach ${doc.id}`);
          }
        } catch (error) {
          logger.warn(`Could not get profile image for coach ${doc.id}:`, error);
        }

        // Combine first and last name into single name field
        const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

        coaches.push({
          id: doc.id,
          name: name || 'Coach',
          title: userData.jobTitle || userData.title || '',
          company: userData.company || '',
          cohort: userData.cohort || userData.graduationYear || 'Coach',
          headshotUrl: headshotUrl,
          linkedinUrl: userData.linkedinUrl || userData.linkedIn || '',
          // Keep original fields for backward compatibility
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          jobTitle: userData.jobTitle || '',
          profileImageUrl: headshotUrl,
          role: userData.role
        });
      }

      // Return in the format expected by the website
      res.json({
        success: true,
        coaches: coaches
      });

    } catch (error) {
      logger.error('Error fetching coaches:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Students function - for external website integration
exports.students = onRequest(
  {
    memory: "256MB",
    timeoutSeconds: 60,
    cors: true
  },
  async (req, res) => {
    try {
      // Get all users with role 'student'
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .where('role', '==', 'student')
        .get();

      const students = [];

      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        let headshotUrl = null;

        // Try to get profile image URL - check multiple possible locations
        try {
          const bucket = admin.storage().bucket();

          // Try different possible image paths
          const imagePaths = [
            `users/${doc.id}/profile.jpg`,
            `users/${doc.id}/profile.png`,
            `headshots/${doc.id}.jpg`,
            `headshots/${doc.id}.png`,
            `headshots/student_${doc.id}.jpg`,
            `headshots/student_${doc.id}.png`
          ];

          for (const imagePath of imagePaths) {
            const file = bucket.file(imagePath);
            const [exists] = await file.exists();

            if (exists) {
              // Generate a public URL that doesn't expire
              const bucketName = bucket.name;
              headshotUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(imagePath)}?alt=media`;
              logger.info(`Found image for student ${doc.id} at ${imagePath}`);
              break;
            }
          }

          if (!headshotUrl) {
            logger.info(`No image found for student ${doc.id}`);
          }
        } catch (error) {
          logger.warn(`Could not get profile image for student ${doc.id}:`, error);
        }

        students.push({
          id: doc.id,
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          major: userData.major || userData.fieldOfStudy || '',
          graduationYear: userData.graduationYear || userData.expectedGraduation || '',
          headshotUrl: headshotUrl,
          linkedinUrl: userData.linkedinUrl || userData.linkedIn || '',
          // Keep original field for backward compatibility
          profileImageUrl: headshotUrl
        });
      }

      // Return in the format expected by the website
      res.json({
        success: true,
        students: students
      });

    } catch (error) {
      logger.error('Error fetching students:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Email notification when a new user registers
const nodemailer = require('nodemailer');

// Test endpoint to manually send a test email
exports.testEmail = onRequest(
  { memory: "256MB", timeoutSeconds: 60 },
  async (req, res) => {
    try {
      logger.info('=== Test email endpoint called ===');

      const gmailEmail = process.env.GMAIL_EMAIL;
      const gmailPassword = process.env.GMAIL_PASSWORD;
      const adminEmail = process.env.ADMIN_EMAIL;

      if (!gmailEmail || !gmailPassword || !adminEmail) {
        res.status(500).json({
          error: 'Email configuration missing',
          config: {
            hasEmail: !!gmailEmail,
            hasPassword: !!gmailPassword,
            hasAdminEmail: !!adminEmail
          }
        });
        return;
      }

      logger.info(`Attempting to send test email from ${gmailEmail} to ${adminEmail}`);

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: gmailEmail,
          pass: gmailPassword
        }
      });

      const mailOptions = {
        from: gmailEmail,
        to: adminEmail,
        subject: '✅ Test Email - Email System Working',
        html: `
          <h2>Email System Test Successful!</h2>
          <p>This is a test email from your Level Up App Cloud Function.</p>
          <p><strong>From:</strong> ${gmailEmail}</p>
          <p><strong>To:</strong> ${adminEmail}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <p>If you received this, your email notification system is configured correctly!</p>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      logger.info(`Test email sent successfully: ${info.messageId}`);

      res.status(200).json({
        success: true,
        messageId: info.messageId,
        from: gmailEmail,
        to: adminEmail
      });

    } catch (error) {
      logger.error('Error sending test email:', error);
      res.status(500).json({
        error: error.message,
        code: error.code,
        stack: error.stack
      });
    }
  }
);

exports.sendNewUserNotification = onDocumentCreated('users/{userId}', async (event) => {
  logger.info('=== sendNewUserNotification triggered ===');

  try {
    const userData = event.data?.data();
    const userId = event.params.userId;

    logger.info(`Event data received for user ID: ${userId}`);
    logger.info(`User data:`, JSON.stringify(userData));

    if (!userData) {
      logger.warn('No user data found in document creation event');
      return;
    }

    logger.info(`Processing new user registration: ${userData.email || userId}`);

    // Use environment variables (Firebase Functions v2 way)
    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_PASSWORD;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!gmailEmail || !gmailPassword || !adminEmail) {
      logger.warn('Gmail credentials or admin email not configured. Skipping email notification.');
      logger.info('Set environment variables: GMAIL_EMAIL, GMAIL_PASSWORD, ADMIN_EMAIL');
      return;
    }

    // Create transporter (works with both Gmail and Google Workspace)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // use TLS
      auth: {
        user: gmailEmail,
        pass: gmailPassword
      }
    });

    // Format user info
    const userName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'N/A';
    const userEmail = userData.email || 'N/A';
    const userRole = userData.role || 'student';
    const timestamp = new Date().toLocaleString();

    // Email content
    const mailOptions = {
      from: gmailEmail,
      to: adminEmail,
      subject: `🎉 New User Registration - ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e2d5f;">New User Registered</h2>
          <p>A new user has registered for the Level Up App!</p>

          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">User Details:</h3>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Role:</strong> ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}</p>
            <p><strong>Firebase UID:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${userId}</code></p>
            <p><strong>Registration Time:</strong> ${timestamp}</p>
          </div>

          <p style="margin-top: 20px;">
            <a href="https://level-up-app-c9f47.web.app"
               style="background-color: #1e2d5f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View in Admin Panel
            </a>
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated notification from Level Up App.<br>
            Firebase Project: level-up-app-c9f47
          </p>
        </div>
      `
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    logger.info(`New user notification email sent successfully: ${info.messageId}`);
    logger.info(`Email sent to: ${adminEmail}`);

  } catch (error) {
    logger.error('Error sending new user notification email:', error);
    // Don't throw - let the function complete even if email fails
  }
});