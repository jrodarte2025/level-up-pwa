// src/components/PostCard.jsx
// Redesigned for the desktop feed (R1). Pure presentation — identical props
// and handler wiring as before (onCommentClick / onLikeClick /
// onEmojiReaction flow up to Updates.jsx; no Firestore access here).
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import DOMPurify from "dompurify";
import { MessageCircle, Link as LinkIcon } from "lucide-react";
import { Typography, Box, Divider, Chip, Card, Button, Avatar } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ReactionBar from "./ReactionBar";
import EmojiPicker from "./EmojiPicker";
import { brandColors } from "../brandColors";

const CLAMP_HEIGHT = 340; // px — long posts collapse past this with a fade

const PostCard = ({ post, onCommentClick, onLikeClick, onEmojiReaction, onEditClick }) => {
  const theme = useTheme();
  const [imageError, setImageError] = React.useState(false);
  const [commentImageErrors, setCommentImageErrors] = React.useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const addReactionButtonRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current && bodyRef.current.scrollHeight > CLAMP_HEIGHT + 60) {
      setNeedsClamp(true);
    }
  }, [post.body]);

  const date = post.timestamp?.seconds
    ? new Date(post.timestamp.seconds * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  // Process reactions for ReactionBar
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

  // Convert post reactions to format expected by ReactionBar
  const processedReactions = {};
  const userReactions = {};

  if (post.reactions) {
    Object.entries(post.reactions).forEach(([emoji, count]) => {
      const key = getEmojiKey(emoji);
      processedReactions[key] = count;
    });
  }

  const handleEmojiClick = (emojiKey, emoji) => {
    if (onEmojiReaction) {
      onEmojiReaction(post.id, emojiKey, emoji);
    }
  };

  const roleLabel =
    post.role === "coach-board"
      ? "Coach + Board"
      : post.role
      ? post.role.charAt(0).toUpperCase() + post.role.slice(1)
      : null;

  const linkHost = (() => {
    if (!post.link) return null;
    try {
      return new URL(post.link.startsWith("http") ? post.link : `https://${post.link}`).hostname.replace(/^www\./, "");
    } catch {
      return post.link;
    }
  })();

  return (
    <Card sx={{ position: "relative", mb: 3, p: { xs: 2.5, md: 3 } }}>
      {/* Author header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        {post.headshotUrl && !imageError ? (
          <Avatar
            src={post.headshotUrl}
            alt={post.displayName}
            imgProps={{ onError: () => setImageError(true) }}
            sx={{ width: 44, height: 44 }}
          />
        ) : (
          <Avatar sx={{ width: 44, height: 44, backgroundColor: brandColors.primary.blue, fontSize: "1rem", fontWeight: 600 }}>
            {post.displayName?.charAt(0)?.toUpperCase() || "?"}
          </Avatar>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", lineHeight: 1.3 }}>
              {post.displayName || "Unknown User"}
            </Typography>
            {roleLabel && (
              <Chip
                label={roleLabel}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  backgroundColor: brandColors.secondary.bluePale,
                  color: brandColors.primary.blue,
                }}
              />
            )}
            {post.alumni && (
              <Chip
                label="Alumni"
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.68rem",
                  backgroundColor: brandColors.accent.tealPale,
                  color: "#2F8990",
                }}
              />
            )}
          </Box>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {date}
          </Typography>
        </Box>
        {post.type && (
          <Chip
            label={post.type}
            size="small"
            sx={{
              backgroundColor: brandColors.primary.coralPale,
              color: brandColors.primary.coral,
              fontWeight: 600,
              fontSize: "0.72rem",
              textTransform: "capitalize",
              flexShrink: 0,
            }}
          />
        )}
      </Box>

      {post.title && (
        <Typography
          component="h3"
          sx={{
            fontFamily: '"Poppins", "Roboto", sans-serif',
            fontWeight: 700,
            fontSize: "1.2rem",
            letterSpacing: "-0.25px",
            lineHeight: 1.3,
            mb: 1,
            color: "text.primary",
          }}
        >
          {post.title}
        </Typography>
      )}

      {post.body && (
        <Box sx={{ position: "relative" }}>
          <Box
            ref={bodyRef}
            sx={{
              maxHeight: needsClamp && !expanded ? `${CLAMP_HEIGHT}px` : "none",
              overflow: "hidden",
            }}
          >
            {/* Check if content is HTML (new posts) or Markdown (legacy posts) */}
            {post.body.includes('<') && post.body.includes('>') ? (
              <Box
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(post.body, {
                    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3'],
                    ALLOWED_ATTR: ['href', 'target', 'rel']
                  })
                }}
                sx={{
                  '& p': {
                    fontSize: "1rem",
                    lineHeight: 1.65,
                    margin: 0,
                    marginBottom: '0.9em',
                    color: "text.primary",
                    wordBreak: 'break-word',
                  },
                  '& p:last-child': { marginBottom: 0 },
                  '& strong, & b': { fontWeight: 600 },
                  '& em, & i': { fontStyle: 'italic' },
                  '& a': {
                    color: theme.palette.secondary.main,
                    textDecoration: 'underline',
                    wordBreak: 'break-word',
                  },
                  '& ul, & ol': { paddingLeft: '1.5rem', margin: '0.5em 0' },
                  '& li': { marginBottom: '0.25em', fontSize: '1rem', lineHeight: 1.6 },
                  '& blockquote': {
                    borderLeft: `3px solid ${brandColors.neutral[200]}`,
                    margin: '0.75em 0',
                    paddingLeft: '1rem',
                    color: 'text.secondary',
                    fontStyle: 'italic',
                  },
                  '& pre': {
                    backgroundColor: brandColors.neutral[100],
                    borderRadius: '0.5rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875em',
                    padding: '0.75rem 1rem',
                    overflowX: 'auto',
                  },
                  '& code': {
                    backgroundColor: brandColors.neutral[100],
                    borderRadius: '0.25rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875em',
                    padding: '0.125rem 0.25rem',
                  },
                  '& h1, & h2, & h3': {
                    fontWeight: 600,
                    lineHeight: 1.3,
                    marginTop: '1em',
                    marginBottom: '0.5em',
                  },
                  '& h1': { fontSize: '1.35rem' },
                  '& h2': { fontSize: '1.2rem' },
                  '& h3': { fontSize: '1.1rem' },
                }}
              />
            ) : (
              /* Fallback for legacy Markdown posts */
              <ReactMarkdown
                rehypePlugins={[rehypeSanitize]}
                components={{
                  h1: () => null,
                  h2: () => null,
                  p: ({ node, ...props }) => (
                    <Typography
                      component="p"
                      sx={{
                        fontSize: "1rem",
                        lineHeight: 1.65,
                        mb: 1.5,
                        color: "text.primary",
                        wordBreak: "break-word"
                      }}
                      {...props}
                    />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: theme.palette.secondary.main,
                        textDecoration: "underline"
                      }}
                    />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong style={{ fontWeight: 600 }}>{props.children}</strong>
                  ),
                  em: ({ node, ...props }) => (
                    <em style={{ fontStyle: "italic" }}>{props.children}</em>
                  )
                }}
              >
                {post.body}
              </ReactMarkdown>
            )}
          </Box>
          {needsClamp && !expanded && (
            <Box
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 80,
                background: `linear-gradient(to bottom, transparent, ${theme.palette.background.paper})`,
                pointerEvents: "none",
              }}
            />
          )}
        </Box>
      )}
      {needsClamp && (
        <Button
          size="small"
          onClick={() => setExpanded(!expanded)}
          sx={{ mt: 0.5, px: 1, minWidth: 0, color: "secondary.main", fontWeight: 600 }}
        >
          {expanded ? "Show less" : "Read more"}
        </Button>
      )}

      {post.link && linkHost && (
        <Box sx={{ mt: 1.5 }}>
          <Button
            component="a"
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="small"
            startIcon={<LinkIcon size={14} />}
            sx={{ textTransform: "none", borderColor: brandColors.neutral[200], color: "primary.main" }}
          >
            {linkHost}
          </Button>
        </Box>
      )}

      {post.imageUrl && (
        <Box sx={{ mt: 2 }}>
          <img
            src={post.imageUrl}
            alt="Post attachment"
            style={{
              width: "100%",
              maxHeight: "500px",
              objectFit: "cover",
              borderRadius: "12px",
              display: "block",
            }}
          />
        </Box>
      )}

      {/* Comment Previews */}
      {post.recentComments && post.recentComments.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Divider sx={{ mb: 1.5, borderColor: brandColors.neutral[150] }} />
          {post.recentComments.map((comment, index) => (
            <Box
              key={comment.id}
              sx={{
                mb: index < post.recentComments.length - 1 ? 1 : 0,
                p: 1.5,
                backgroundColor: brandColors.neutral[100],
                borderRadius: 2,
                transition: 'background-color 0.15s ease',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: brandColors.neutral[150],
                },
              }}
              onClick={() => onCommentClick(post.id)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {comment.headshotUrl && !commentImageErrors[comment.id] ? (
                  <Avatar
                    src={comment.headshotUrl}
                    alt={comment.displayName}
                    imgProps={{
                      onError: () =>
                        setCommentImageErrors(prev => ({ ...prev, [comment.id]: true })),
                    }}
                    sx={{ width: 22, height: 22 }}
                  />
                ) : (
                  <Avatar sx={{ width: 22, height: 22, backgroundColor: brandColors.primary.blue, fontSize: '0.65rem', fontWeight: 600 }}>
                    {comment.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </Avatar>
                )}
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                  {comment.displayName || 'Unknown User'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
                  {comment.timestamp?.seconds
                    ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric'
                      })
                    : ''}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.875rem',
                  lineHeight: 1.45,
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  pl: 3.75,
                  wordBreak: 'break-word'
                }}
              >
                {comment.text}
              </Typography>
            </Box>
          ))}
          {post.commentCount > post.recentComments.length && (
            <Box sx={{ mt: 1, cursor: 'pointer' }} onClick={() => onCommentClick(post.id)}>
              <Typography
                variant="caption"
                sx={{
                  color: 'secondary.main',
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                View {post.commentCount - post.recentComments.length} more comments
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Divider sx={{ mt: 2, mb: 1.5, borderColor: brandColors.neutral[150] }} />
      <Box display="flex" gap={2} alignItems="center">
        {/* Emoji Reactions */}
        <ReactionBar
          reactions={processedReactions}
          userReactions={userReactions}
          onReactionClick={handleEmojiClick}
          onAddReaction={() => setShowEmojiPicker(true)}
          commentId={post.id}
          addButtonRef={addReactionButtonRef}
        />

        <Box
          component="button"
          onClick={() => onCommentClick(post.id)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            border: "none",
            background: "none",
            color: "text.secondary",
            cursor: "pointer",
            opacity: 0.8,
            transition: "opacity 0.2s",
            "&:hover": {
              color: "primary.main",
              opacity: 1
            },
          }}
        >
          <MessageCircle size={18} />
          <Typography
            variant="caption"
            sx={{ color: (theme) => theme.palette.text.secondary }}
          >
            {post.commentCount || 0}
          </Typography>
        </Box>
      </Box>

      {/* Emoji Picker */}
      <EmojiPicker
        isOpen={showEmojiPicker}
        onEmojiSelect={handleEmojiClick}
        onClose={() => setShowEmojiPicker(false)}
        anchorEl={addReactionButtonRef.current}
        userReactions={userReactions}
      />
    </Card>
  );
};

export default PostCard;
