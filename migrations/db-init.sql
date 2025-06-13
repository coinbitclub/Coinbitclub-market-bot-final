
/* =============================================
   migrations/db-init.sql
   ============================================= */
-- Índices para performance
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_metrics_time ON market_metrics(captured_at);
