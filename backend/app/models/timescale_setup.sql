-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert gpu_metrics to hypertable (run after table creation)
SELECT create_hypertable('gpu_metrics', 'time', if_not_exists => TRUE);

-- Create continuous aggregate for hourly stats
CREATE MATERIALIZED VIEW IF NOT EXISTS gpu_hourly_stats
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS hour,
       gpu_id,
       AVG(utilization_pct) AS avg_utilization,
       AVG(memory_used_mb) AS avg_memory_used,
       AVG(memory_free_mb) AS avg_memory_free,
       AVG(temperature_c) AS avg_temperature,
       AVG(power_usage_w) AS avg_power
FROM gpu_metrics
GROUP BY hour, gpu_id;

-- Add retention policy (60 days)
SELECT add_retention_policy('gpu_metrics', INTERVAL '60 days');