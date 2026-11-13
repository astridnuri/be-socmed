ALTER TABLE comments
  ADD COLUMN parent_comment_id INT NULL AFTER user_id,
  ADD INDEX comments_parent_comment_id_IDX (parent_comment_id);
