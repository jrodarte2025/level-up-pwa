import React, { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "@mui/material/styles";
import { Box, Typography, Divider } from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";
import { MessageCircle, Heart, Pencil, Trash } from "lucide-react";
import Comment from "../components/Comment";
import HeaderBar from "../components/HeaderBar";
import CommentInput from "../components/CommentInput";
import TypingIndicator from "../components/TypingIndicator";
import ReactionBar from "../components/ReactionBar";
import EmojiPicker from "../components/EmojiPicker";
import { useTyping } from "../contexts/TypingContext";

const PostPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromTab = location.state?.fromTab || "updates";
  const auth = getAuth();
  const user = {
    ...auth.currentUser,
    displayName: auth.currentUser?.firstName && auth.currentUser?.lastName
      ? `${auth.currentUser.firstName} ${auth.currentUser.lastName}`
      : auth.currentUser?.displayName || auth.currentUser?.email
  };
  const [fullUser, setFullUser] = useState(null);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  // Reaction bar state
  const [likes, setLikes] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedCommentText, setEditedCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Post reaction states
  const [postReactions, setPostReactions] = useState({});
  const [userPostReactions, setUserPostReactions] = useState({});
  const [showPostEmojiPicker, setShowPostEmojiPicker] = useState(false);
  const postAddReactionButtonRef = useRef(null);
  
  const { typingUsers, markCommentAsNew, isCommentNew } = useTyping();

  const inputRef = useRef(null);

  const theme = useTheme();

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setFullUser({ id: userSnap.id, ...userSnap.data() });
        }
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);

  const userHasLiked = (commentId) => {
    return Object.keys(likes).includes(commentId) && likes[commentId + "_liked"];
  };

  // Tally likes and replies after comments load
  useEffect(() => {
    const likeTally = {};
    const repliesTally = {};

    comments.forEach((c) => {
      likeTally[c.id] = c.likes?.length || 0;
      likeTally[c.id + "_liked"] = !!c.reactions?.[user?.uid || user?.email];
      if (c.parentCommentId) {
        repliesTally[c.parentCommentId] = (repliesTally[c.parentCommentId] || 0) + 1;
      }
    });

    setLikes(likeTally);
    setCommentCounts(repliesTally);
  }, [comments]);

  // Firestore-enabled like handler (legacy heart support)
  const handleLike = async (commentId) => {
    const userId = user?.uid || user?.email;
    const reactionRef = doc(db, "posts", postId, "comments", commentId, "reactions", userId);
    const existing = await getDoc(reactionRef);

    if (existing.exists()) {
      await deleteDoc(reactionRef);
      setLikes((prev) => ({
        ...prev,
        [commentId]: Math.max((prev[commentId] || 1) - 1, 0),
        [commentId + "_liked"]: false,
      }));
    } else {
      await setDoc(reactionRef, {
        emoji: "❤️",
        userId,
        timestamp: serverTimestamp()
      });
      setLikes((prev) => ({
        ...prev,
        [commentId]: (prev[commentId] || 0) + 1,
        [commentId + "_liked"]: true,
      }));
    }
  };

  // Enhanced emoji reaction handler for comments
  const handleEmojiReaction = async (commentId, emojiKey, emoji) => {
    const userId = user?.uid || user?.email;
    const reactionRef = doc(db, "posts", postId, "comments", commentId, "reactions", userId);
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

  // Post emoji reaction handler
  const handlePostEmojiReaction = async (emojiKey, emoji) => {
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

  // Listen to post reactions
  useEffect(() => {
    if (!postId || !user) return;

    const userId = user?.uid || user?.email;
    const postReactionsRef = collection(db, "posts", postId, "reactions");

    const unsubscribe = onSnapshot(postReactionsRef, (snapshot) => {
      const reactionCounts = {};
      const userReactionStatus = {};

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const emoji = data.emoji || "❤️";
        const reactionUserId = doc.id;
        
        // Map emoji to key
        const emojiKey = getEmojiKey(emoji);
        reactionCounts[emojiKey] = (reactionCounts[emojiKey] || 0) + 1;
        
        if (reactionUserId === userId) {
          userReactionStatus[emojiKey] = true;
        }
      });

      setPostReactions(reactionCounts);
      setUserPostReactions(userReactionStatus);
    });

    return () => unsubscribe();
  }, [postId, user]);

  const getEmojiKey = (emoji) => {
    const emojiMap = {
      "👍": "thumbs_up",
      "❤️": "heart",
      "😂": "laughing",
      "😮": "wow",
      "😢": "sad",
      "🔥": "fire",
      "👏": "clap",
      "🎉": "celebration"
    };
    return emojiMap[emoji] || "heart";
  };

  useEffect(() => {
    const fetchPost = async () => {
      const postRef = doc(db, "posts", postId);
      const snap = await getDoc(postRef);
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
      }
    };

    fetchPost();

    const commentsRef = collection(db, "posts", postId, "comments");
    const q = query(commentsRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const loaded = snap.docs.map((doc) => {
        const c = { id: doc.id, ...doc.data() };
        if (c.userId === fullUser?.id) {
          return {
            ...c,
            headshotUrl: fullUser?.headshotUrl || "",
            displayName: fullUser?.displayName ||
              (fullUser?.firstName && fullUser?.lastName
                ? `${fullUser.firstName} ${fullUser.lastName}`
                : c.displayName || c.userId)
          };
        }
        return c;
      });
      setComments(loaded);
    });

    return () => unsubscribe();
  }, [postId, fullUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setIsSubmitting(true);

    const commentRef = collection(db, "posts", postId, "comments");
    
    // If replying, get parent comment info
    let replyToUser = null;
    let replyToText = null;
    if (replyTo) {
      const parentComment = comments.find(c => c.id === replyTo);
      if (parentComment) {
        replyToUser = parentComment.displayName;
        replyToText = parentComment.text?.substring(0, 50) + (parentComment.text?.length > 50 ? '...' : '');
      }
    }
    
    const commentData = {
      userId: user?.uid || user?.email,
      displayName: fullUser?.displayName ||
        (fullUser?.firstName && fullUser?.lastName
          ? `${fullUser.firstName} ${fullUser.lastName}`
          : user?.displayName || user?.email),
      text: newComment,
      timestamp: serverTimestamp(),
      parentCommentId: replyTo || null,
      replyToUser: replyToUser,
      replyToText: replyToText,
      headshotUrl: fullUser?.headshotUrl || "",
    };

    const newCommentDoc = await addDoc(commentRef, commentData);
    
    // Mark comment as new for highlighting
    markCommentAsNew(newCommentDoc.id);
    
    setNewComment("");
    setReplyTo(null);
    setIsSubmitting(false);
  };

  const groupedComments = comments.reduce((acc, comment) => {
    const parent = comment.parentCommentId || "root";
    acc[parent] = [...(acc[parent] || []), comment];
    return acc;
  }, {});

  const renderComments = (parentId = "root", depth = 0) => {
    const maxDepth = 4; // Limit nesting to prevent excessive indentation
    const currentComments = groupedComments[parentId] || [];
    
    return currentComments.map((c) => (
      <Box 
        key={c.id} 
        sx={{ 
          mb: depth === 0 ? 3 : 2,
          ml: depth > 0 ? 2 : 0,
          pl: depth > 0 ? 2 : 0,
          borderLeft: depth > 0 ? `3px solid ${theme.palette.divider}` : 'none',
          position: 'relative',
          '&::before': depth > 0 ? {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            background: `linear-gradient(to bottom, ${theme.palette.primary.main}20, ${theme.palette.divider})`,
            borderRadius: '2px 0 0 2px'
          } : {}
        }}
      >
        <Comment
          comment={{ ...c, postId }}
          avatarUrl={c.headshotUrl || ""}
          isNew={isCommentNew(c.id)}
          onReply={() => setReplyTo(c.id)}
          onLike={() => handleLike(c.id)}
          onEmojiReaction={handleEmojiReaction}
          onDelete={async () => {
            await deleteDoc(doc(db, "posts", postId, "comments", c.id));
          }}
          onEdit={() => {
            setEditingCommentId(c.id);
            setEditedCommentText(c.text);
            inputRef.current?.focus();
          }}
          onCancelEdit={() => {
            setEditingCommentId(null);
            setEditedCommentText("");
          }}
          isEditing={editingCommentId === c.id}
          editedText={editedCommentText}
          setEditedText={setEditedCommentText}
          onSubmitEdit={async () => {
            if (editedCommentText.trim()) {
              const ref = doc(db, "posts", postId, "comments", c.id);
              await setDoc(ref, { text: editedCommentText }, { merge: true });
              setEditingCommentId(null);
              setEditedCommentText("");
            }
          }}
          replyCount={commentCounts[c.id] || 0}
          userId={user?.uid || user?.email}
          depth={depth}
          maxDepth={maxDepth}
        />
        
        {/* Render nested replies */}
        {depth < maxDepth && groupedComments[c.id] && groupedComments[c.id].length > 0 && (
          <Box sx={{ mt: 1 }}>
            {renderComments(c.id, depth + 1)}
          </Box>
        )}
        
        {/* Show "more replies" indicator if max depth reached */}
        {depth === maxDepth && groupedComments[c.id] && groupedComments[c.id].length > 0 && (
          <Box 
            sx={{ 
              mt: 1, 
              ml: 2, 
              pl: 2,
              borderLeft: `2px solid ${theme.palette.divider}`,
              opacity: 0.7
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                color: theme.palette.text.secondary,
                fontStyle: 'italic',
                cursor: 'pointer',
                '&:hover': {
                  color: theme.palette.primary.main,
                  textDecoration: 'underline'
                }
              }}
              onClick={() => {
                // TODO: Implement expand deep replies functionality
                console.log('Expand deep replies for comment:', c.id);
              }}
            >
              View {groupedComments[c.id].length} more {groupedComments[c.id].length === 1 ? 'reply' : 'replies'}...
            </Typography>
          </Box>
        )}
      </Box>
    ));
  };

  return (
    <Box
      sx={{
        p: { xs: 2, md: 0 },
        maxWidth: 680,
        mx: "auto",
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }}
    >
      {/* Back button for returning to Updates */}
      <button
        onClick={() => navigate("/", { state: { selectedTab: "updates" } })}
        style={{
          background: "none",
          border: "none",
          color: "var(--brand-primary-coral)",
          fontWeight: 500,
          fontSize: "0.875rem",
          textDecoration: "underline",
          marginBottom: "1rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}
      >
        ← Return to Updates
      </button>
      {post ? (
        <Box
          sx={{
            backgroundColor: theme.palette.background.paper,
            p: "1rem",
            borderRadius: "12px",
            boxShadow: theme.palette.mode === "dark"
              ? "0 1px 3px rgba(0, 0, 0, 0.7)"
              : "0 1px 3px rgba(0, 0, 0, 0.1)",
            mb: "1.5rem",
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: "0.5rem", color: theme.palette.text.primary }}>
            {post.title}
          </Typography>
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => (
                <Typography
                  variant="body1"
                  gutterBottom
                  sx={{ color: theme.palette.text.primary, lineHeight: 1.6 }}
                  {...props}
                />
              ),
              a: ({ node, ...props }) => (
                <a
                  {...props}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--brand-primary-coral)",
                    textDecoration: "underline"
                  }}
                />
              )
            }}
          >
            {post.body}
          </ReactMarkdown>
          {post.link && (
            <a
              href={post.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--brand-primary-coral)",
                textDecoration: "underline",
                fontSize: "0.875rem"
              }}
            >
              {post.link}
            </a>
          )}
          <Typography
            variant="caption"
            sx={{ display: "block", mt: "1rem", color: theme.palette.text.secondary }}
          >
            Posted by {post.displayName || "Unknown"} · {new Date(post.timestamp?.toDate?.()).toLocaleDateString()}
          </Typography>
        </Box>
      ) : (
        <Typography sx={{ color: theme.palette.text.primary }}>Loading post...</Typography>
      )}

      <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />

      {/* Post Reactions and Comments Header */}
      <Box sx={{ mb: "1rem" }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <ReactionBar
            reactions={postReactions}
            userReactions={userPostReactions}
            onReactionClick={handlePostEmojiReaction}
            onAddReaction={() => setShowPostEmojiPicker(true)}
            commentId={postId}
            addButtonRef={postAddReactionButtonRef}
          />
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 600, 
              color: theme.palette.text.primary,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}
          >
            <MessageCircle size={16} />
            {comments.filter((c) => !c.parentCommentId).length} Comments
          </Typography>
        </Box>
        
        {/* Typing Indicator */}
        <TypingIndicator 
          typingUsers={typingUsers[postId] || []} 
          postId={postId}
        />
        
        {/* Render comments directly, no extra wrapper adding background, padding, or border */}
        {renderComments()}
      </Box>

      {!editingCommentId && (
        <Box sx={{ mt: 3 }}>
          <CommentInput
            value={newComment}
            onChange={setNewComment}
            onSubmit={handleSubmit}
            onCancel={() => setReplyTo(null)}
            placeholder={replyTo ? `Reply to ${comments.find(c => c.id === replyTo)?.displayName || 'comment'}...` : "Write a comment..."}
            isSubmitting={isSubmitting}
            replyTo={replyTo}
            replyToUser={comments.find(c => c.id === replyTo)?.displayName}
            replyToText={comments.find(c => c.id === replyTo)?.text?.substring(0, 100) + (comments.find(c => c.id === replyTo)?.text?.length > 100 ? '...' : '')}
            autoFocus={!!replyTo}
            postId={postId}
          />
        </Box>
      )}
      
      {/* Post Emoji Picker */}
      <EmojiPicker
        isOpen={showPostEmojiPicker}
        onEmojiSelect={handlePostEmojiReaction}
        onClose={() => setShowPostEmojiPicker(false)}
        anchorEl={postAddReactionButtonRef.current}
        userReactions={userPostReactions}
      />
    </Box>
  );
};

export default PostPage;