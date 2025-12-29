import { useState } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import type { PostOutput } from '../types';
import { MIN_TITLE_LENGTH, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH } from '../types';
import './CreatePostForm.css';

interface Props {
  onPostCreated: (post: PostOutput) => void;
}

export function CreatePostForm({ onPostCreated }: Props) {
  const { client } = useHolochain();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isValidTitle = title.trim().length >= MIN_TITLE_LENGTH && title.length <= MAX_TITLE_LENGTH;
  const isValidContent = content.trim().length > 0 && content.length <= MAX_CONTENT_LENGTH;
  const canSubmit = isValidTitle && isValidContent && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!client || !canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'feed',
        fn_name: 'create_post',
        payload: {
          title: title.trim(),
          content: content.trim(),
        },
      });

      // Clear form and collapse
      setTitle('');
      setContent('');
      setIsExpanded(false);

      // Notify parent
      onPostCreated(result);
    } catch (err) {
      console.error('Failed to create post:', err);
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setContent('');
    setError(null);
    setIsExpanded(false);
  };

  return (
    <div className={`create-post-form ${isExpanded ? 'expanded' : ''}`}>
      {!isExpanded ? (
        <button 
          className="expand-trigger"
          onClick={() => setIsExpanded(true)}
        >
          <span className="trigger-icon">✏️</span>
          <span>Share something with your neighbors...</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-header">
            <h3>📝 New Post</h3>
          </div>

          <div className="form-group">
            <label htmlFor="post-title">Title</label>
            <input
              type="text"
              id="post-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's this about?"
              maxLength={MAX_TITLE_LENGTH}
              autoFocus
            />
            <div className="field-info">
              <span className={title.trim().length < MIN_TITLE_LENGTH ? 'warning' : ''}>
                {title.trim().length < MIN_TITLE_LENGTH 
                  ? `At least ${MIN_TITLE_LENGTH} characters needed`
                  : ''}
              </span>
              <span className="char-count">{title.length}/{MAX_TITLE_LENGTH}</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="post-content">Content</label>
            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share the details with your neighbors..."
              maxLength={MAX_CONTENT_LENGTH}
              rows={5}
            />
            <div className="field-info">
              <span></span>
              <span className="char-count">{content.length}/{MAX_CONTENT_LENGTH}</span>
            </div>
          </div>

          {error && (
            <div className="form-error">
              ⚠️ {error}
            </div>
          )}

          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-btn"
              disabled={!canSubmit}
            >
              {isSubmitting ? 'Posting...' : 'Share with Neighbors'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
