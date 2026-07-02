import React, { useEffect, useState, useRef } from "react";
import {
  collection, query, where, orderBy, onSnapshot, addDoc,
  serverTimestamp, getDocs, deleteDoc, doc, getDoc, setDoc, limit
} from "firebase/firestore";
import { db, auth } from "../firebase";
import PostCard from "../components/PostCard";
import CardWrapper from "../components/CardWrapper";
import { Container, Typography, Box, Button, Card, CardContent } from "@mui/material";
import { ChatBubbleOutline as ChatIcon, ArrowForward as ArrowIcon } from "@mui/icons-material";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Updates() {
  const [posts, setPosts] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentCountsByPost, setCommentCountsByPost] = useState({});
  const [newComment, setNewComment] = useState({});
  const [reactionsByPost, setReactionsByPost] = useState({});
  const user = auth.currentUser;
  const [userRole, setUserRole] = useState(null);

  // Load user role (optimized)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setUserRole(userDoc.data().role);
      }
    })();
  }, [user]);

  // Track nested listeners for posts' comments and reactions
  const postListenersRef = useRef({});

  // Load posts, reactions, comments with proper cleanup for nested listeners
  useEffect(() => {
    if (!userRole) return;
    const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchData = async () => {
        const data = await Promise.all(snapshot.docs.map(async d => {
          const postData = d.data();
          const visibleTo = Array.isArray(postData.visibleTo) ? postData.visibleTo : null;
          if (userRole !== "admin" && visibleTo && !visibleTo.includes(userRole)) return null;

          return {
            id: d.id,
            ...postData,
          };
        }));
        setPosts(data.filter(Boolean));
      };
      fetchData();

      // Clean up any existing nested listeners before setting new ones
      Object.values(postListenersRef.current).forEach(unsubFn => unsubFn && unsubFn());
      postListenersRef.current = {};

      snapshot.docs.forEach((docSnap) => {
        const postId = docSnap.id;

        // Recent comments listener - get 3 most recent comments
        const recentCommentsQuery = query(
          collection(db, "posts", postId, "comments"),
          orderBy("timestamp", "desc"),
          limit(3)
        );
        const commentsUnsub = onSnapshot(recentCommentsQuery, (snap) => {
          const comments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setCommentsByPost(prev => ({
            ...prev,
            [postId]: comments
          }));
        });
        postListenersRef.current[`${postId}-comments`] = commentsUnsub;

        // Total comment count listener
        const allCommentsUnsub = onSnapshot(collection(db, "posts", postId, "comments"), (snap) => {
          setCommentCountsByPost(prev => ({
            ...prev,
            [postId]: snap.size
          }));
        });
        postListenersRef.current[`${postId}-comment-count`] = allCommentsUnsub;

        // Reactions listener
        const reactionsUnsub = onSnapshot(collection(db, "posts", postId, "reactions"), (snap) => {
          const counts = {};
          snap.docs.forEach(r => {
            const d = r.data();
            if (d.emoji) counts[d.emoji] = (counts[d.emoji] || 0) + 1;
          });
          setReactionsByPost(prev => ({ ...prev, [postId]: counts }));
        });
        postListenersRef.current[`${postId}-reactions`] = reactionsUnsub;
      });
    });
    return () => {
      unsub();
      Object.values(postListenersRef.current).forEach(unsubFn => unsubFn && unsubFn());
    };
  }, [userRole]);

  const handleCommentClick = (postId) => {
    window.location.href = `/post/${postId}`;
  };

  const handleLikeClick = async (postId) => {
    const userId = user?.uid || user?.email;
    const reactionRef = doc(db, "posts", postId, "reactions", userId);
    const existing = await getDoc(reactionRef);

    if (existing.exists()) {
      await deleteDoc(reactionRef); // Remove like
    } else {
      await setDoc(reactionRef, {
        emoji: "❤️",
        userId,
        timestamp: serverTimestamp()
      });
    }
  };

  const isLikedByUser = (postId) => {
    const userId = user?.uid || user?.email;
    const userReactions = reactionsByPost[postId] || {};
    return !!userReactions["❤️"];
  };

  // Enhanced emoji reaction handler for posts
  const handlePostEmojiReaction = async (postId, emojiKey, emoji) => {
    const userId = user?.uid || user?.email;
    const reactionRef = doc(db, "posts", postId, "reactions", userId);
    const existing = await getDoc(reactionRef);

    if (existing.exists() && existing.data().emoji === emoji) {
      // Remove reaction if same emoji
      await deleteDoc(reactionRef);
    } else {
      // Add or update reaction
      await setDoc(reactionRef, {
        emoji: emoji,
        emojiKey: emojiKey,
        userId,
        timestamp: serverTimestamp()
      });
    }
  };

  const groupMeCard = (
    <Card
      sx={{
        background: 'linear-gradient(135deg, #4CAFB6 0%, #18264E 100%)',
        border: 'none',
        borderRadius: 3,
        boxShadow: '0 4px 12px rgba(76, 175, 182, 0.3)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 6px 16px rgba(76, 175, 182, 0.4)'
        }
      }}
      onClick={() => window.open('https://groupme.com/join_group/111057832/9TtW2MIp', '_blank')}
    >
      <CardContent sx={{ py: 2.5, px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChatIcon sx={{ fontSize: 28, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}
            >
              Join Our Community Chat
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.875rem', lineHeight: 1.4 }}
            >
              Connect with scholars and coaches in our GroupMe! Share ideas, ask questions, and stay engaged.
            </Typography>
          </Box>
          <ArrowIcon sx={{ color: '#fff', fontSize: 24 }} />
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        gap: 3,
        alignItems: 'start',
      }}
    >
      {/* Feed column */}
      <Box sx={{ minWidth: 0, maxWidth: 680, order: { xs: 2, md: 1 } }}>
        {posts.length > 0 ? (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                ...post,
                roles: Array.isArray(post.roles) ? post.roles : [],
                reactionCount: Object.values(reactionsByPost[post.id] || {}).reduce((a, b) => a + b, 0),
                reactions: reactionsByPost[post.id] || {},
                isLiked: isLikedByUser(post.id),
                commentCount: commentCountsByPost[post.id] || 0,
                recentComments: commentsByPost[post.id]?.slice(0, 3) || [],
              }}
              onCommentClick={handleCommentClick}
              onLikeClick={handleLikeClick}
              onEmojiReaction={handlePostEmojiReaction}
            />
          ))
        ) : (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No updates yet — check back soon!
            </Typography>
          </Card>
        )}
      </Box>

      {/* Right rail (stacks above the feed on small screens) */}
      <Box
        sx={{
          order: { xs: 1, md: 2 },
          position: { md: 'sticky' },
          top: { md: 32 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          mb: { xs: 1, md: 0 },
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ px: { xs: 1, md: 0.5 } }}>
          Official updates, wins, and announcements from the Level Up team.
        </Typography>
        {groupMeCard}
      </Box>
    </Box>
  );
}
