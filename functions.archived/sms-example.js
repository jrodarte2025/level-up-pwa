/**
 * Example Cloud Function for sending SMS notifications
 * Requires Twilio or similar SMS service
 */

// This is just an example structure for future SMS functionality
// You'll need to install and configure an SMS service like Twilio

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Example with Twilio (requires: npm install twilio)
// const twilio = require('twilio');
// const client = twilio(
//   functions.config().twilio.account_sid,
//   functions.config().twilio.auth_token
// );

/**
 * Send SMS notification for critical events
 */
exports.sendEventReminderSMS = functions.pubsub
  .schedule('every day 09:00')
  .onRun(async (context) => {
    // Get events happening today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const eventsSnapshot = await admin.firestore()
      .collection('events')
      .where('date', '>=', today)
      .where('date', '<', tomorrow)
      .get();

    if (eventsSnapshot.empty) {
      console.log('No events today');
      return null;
    }

    // Get users who have opted in for SMS notifications
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('smsNotifications', '==', true)
      .where('phoneNumber', '!=', '')
      .get();

    const smsPromises = [];

    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      if (userData.phoneNumber) {
        // Format phone number for SMS (+1 for US)
        const phoneNumber = '+1' + userData.phoneNumber;

        // Example SMS send (uncomment and configure when ready)
        // smsPromises.push(
        //   client.messages.create({
        //     to: phoneNumber,
        //     from: functions.config().twilio.phone_number,
        //     body: `Reminder: You have Level Up events today! Check the app for details.`
        //   })
        // );
      }
    });

    // await Promise.all(smsPromises);
    console.log(`Would send ${smsPromises.length} SMS notifications`);
    return null;
  });

/**
 * Validate phone number when user updates profile
 */
exports.validatePhoneNumber = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();

    // Check if phone number was changed
    if (newData.phoneNumber !== previousData.phoneNumber) {
      // Log phone number changes for audit
      await admin.firestore().collection('audit').add({
        userId: context.params.userId,
        action: 'phone_number_changed',
        previousPhone: previousData.phoneNumber || 'none',
        newPhone: newData.phoneNumber || 'none',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return null;
  });