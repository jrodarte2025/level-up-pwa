import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Box, Typography } from "@mui/material";
import Comment from "../components/Comment";

const CommentThreadPage = () => {
  const { postId, commentId } = useParams();
  const navigate = useNavigate();
  const [parentComment, setParentComment] = useState(null);
  const [replies, setReplies] = useState([]);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedCommentText, setEditedCommentText] = useState("");

  const handleLike = async (commentId) => {
    const user = getAuth().currentUser;
    if (!user) return;
    const userId = user.uid || user.email;

    const reactionRef = doc(db, "posts", postId, "comments", commentId, "reactions", userId);
    const existing = await getDoc(reactionRef);

    if (existing.exists()) {
      await deleteDoc(reactionRef);
    } else {
      await setDoc(reactionRef, {
        emoji: "❤️",
        userId,
        timestamp: serverTimestamp()
      });
    }
  };

  useEffect(() => {
    const fetchCommentThread = async () => {
      // Load parent comment
      const parentRef = doc(db, "posts", postId, "comments", commentId);
      const parentSnap = await getDoc(parentRef);
      if (parentSnap.exists()) {
        setParentComment({ id: parentSnap.id, ...parentSnap.data(), postId });
      }

      // Load replies to the comment
      const repliesRef = collection(db, "posts", postId, "comments");
      const repliesQuery = query(repliesRef, where("parentCommentId", "==", commentId));
      const repliesSnap = await getDocs(repliesQuery);
      const loadedReplies = repliesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        postId
      }));
      setReplies(loadedReplies);
    };

    fetchCommentThread();
  }, [postId, commentId]);

  return (
    <Box sx={{ maxWidth: 680, mx: "auto", p: { xs: 2, md: 0 } }}>
      <button
        onClick={() => navigate(`/post/${postId}`)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          color: theme => theme.palette.primary.main,
          marginBottom: "1rem"
        }}
      >
        ← Back to Post
      </button>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Conversation Thread
      </Typography>

      {parentComment && (
        <Comment
          comment={{ ...parentComment, replies: [] }}
          onReply={() => {}}
          onLike={() => handleLike(parentComment.id)}
          onEdit={(comment) => {
            if (!comment || !comment.id) {
              setEditingCommentId(null);
              setEditedCommentText("");
            } else {
              setEditingCommentId(comment.id);
              setEditedCommentText(comment.text || "");
            }
          }}
          onDelete={() => {}}
          isEditing={editingCommentId === parentComment.id}
          editedText={editedCommentText}
          setEditedText={setEditedCommentText}
          onSubmitEdit={async () => {
            if (!editedCommentText.trim()) return;
            await setDoc(doc(db, "posts", postId, "comments", parentComment.id), { text: editedCommentText }, { merge: true });
            setEditingCommentId(null);
            setEditedCommentText("");
          }}
          suppressReplies={true}
        />
      )}

      {replies.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Replies
          </Typography>
          {replies.map(reply => (
            <Comment
              key={reply.id}
              comment={{ ...reply, replies: [], replyingToName: parentComment?.displayName || "a comment" }}
              onReply={() => {}}
              onLike={() => handleLike(reply.id)}
              onEdit={(comment) => {
                if (!comment || !comment.id) {
                  setEditingCommentId(null);
                  setEditedCommentText("");
                } else {
                  setEditingCommentId(comment.id);
                  setEditedCommentText(comment.text || "");
                }
              }}
              onDelete={() => {}}
              isEditing={editingCommentId === reply.id}
              editedText={editedCommentText}
              setEditedText={setEditedCommentText}
              onSubmitEdit={async () => {
                if (!editedCommentText.trim()) return;
                await setDoc(doc(db, "posts", postId, "comments", reply.id), { text: editedCommentText }, { merge: true });
                setEditingCommentId(null);
                setEditedCommentText("");
              }}
              suppressReplies={true}
              depth={1}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default CommentThreadPage;