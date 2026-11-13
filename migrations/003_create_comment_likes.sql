CREATE TABLE comment_likes (
  comment_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, user_id),
  KEY comment_likes_users_FK (user_id),
  CONSTRAINT comment_likes_comments_FK
    FOREIGN KEY (comment_id) REFERENCES comments (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT comment_likes_users_FK
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
