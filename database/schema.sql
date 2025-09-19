-- PostgreSQL Database Schema for Banana Sales Tracker
-- Designed for multi-device synchronization with conflict resolution

-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable timestamp functions
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create database (run this separately if needed)
-- CREATE DATABASE banana_sales;

-- Sales table with comprehensive tracking
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product VARCHAR(255) NOT NULL DEFAULT 'Bananas',
    quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
    customer VARCHAR(255) NOT NULL,
    notes TEXT,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
    payment_method VARCHAR(50),
    amount_received DECIMAL(10,2) DEFAULT 0 CHECK (amount_received >= 0),
    outstanding_balance DECIMAL(10,2) GENERATED ALWAYS AS (total - amount_received) STORED,
    
    -- Synchronization and conflict resolution fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    device_id VARCHAR(255),
    user_id VARCHAR(255) DEFAULT 'anonymous',
    
    -- Soft delete support
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Sync tracking
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict'))
);

-- Device tracking table for multi-device synchronization
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'mobile', 'desktop', 'tablet'
    user_agent TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sync log table for tracking synchronization events
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(255) NOT NULL,
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('create', 'update', 'delete', 'sync')),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    conflict_resolved BOOLEAN DEFAULT FALSE,
    resolution_strategy VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Conflict resolution table for handling data conflicts
CREATE TABLE conflicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    device_id_1 VARCHAR(255) NOT NULL,
    device_id_2 VARCHAR(255) NOT NULL,
    data_1 JSONB NOT NULL,
    data_2 JSONB NOT NULL,
    resolution_data JSONB,
    resolution_strategy VARCHAR(50),
    resolved_at TIMESTAMP WITH TIME ZONE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization

-- Sales table indexes
CREATE INDEX idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX idx_sales_updated_at ON sales(updated_at DESC);
CREATE INDEX idx_sales_device_id ON sales(device_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_payment_status ON sales(payment_status);
CREATE INDEX idx_sales_sync_status ON sales(sync_status);
CREATE INDEX idx_sales_deleted ON sales(is_deleted, deleted_at);
CREATE INDEX idx_sales_customer ON sales(customer);
CREATE INDEX idx_sales_total ON sales(total DESC);

-- Composite indexes for common queries
CREATE INDEX idx_sales_active_recent ON sales(created_at DESC, is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_sales_pending_sync ON sales(sync_status, updated_at) WHERE sync_status = 'pending';
CREATE INDEX idx_sales_device_version ON sales(device_id, version, updated_at);

-- Device table indexes
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at DESC);
CREATE INDEX idx_devices_active ON devices(is_active);

-- Sync log indexes
CREATE INDEX idx_sync_log_device_id ON sync_log(device_id);
CREATE INDEX idx_sync_log_created_at ON sync_log(created_at DESC);
CREATE INDEX idx_sync_log_operation ON sync_log(operation_type, created_at DESC);
CREATE INDEX idx_sync_log_record ON sync_log(table_name, record_id);

-- Conflict table indexes
CREATE INDEX idx_conflicts_resolved ON conflicts(is_resolved, created_at);
CREATE INDEX idx_conflicts_record ON conflicts(table_name, record_id);

-- Triggers for automatic timestamp updates

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for sales table
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function for conflict detection
CREATE OR REPLACE FUNCTION detect_conflicts()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there's a concurrent update from a different device
    IF OLD.version != NEW.version - 1 AND OLD.device_id != NEW.device_id THEN
        -- Log the conflict
        INSERT INTO conflicts (table_name, record_id, device_id_1, device_id_2, data_1, data_2)
        VALUES (
            TG_TABLE_NAME,
            NEW.id,
            OLD.device_id,
            NEW.device_id,
            row_to_json(OLD),
            row_to_json(NEW)
        );
        
        -- Mark as conflict
        NEW.sync_status = 'conflict';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for conflict detection
CREATE TRIGGER detect_sales_conflicts
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION detect_conflicts();

-- Views for common queries

-- Active sales view (non-deleted)
CREATE VIEW active_sales AS
SELECT *
FROM sales
WHERE is_deleted = FALSE
ORDER BY created_at DESC;

-- Sales summary view
CREATE VIEW sales_summary AS
SELECT 
    COUNT(*) as total_sales,
    SUM(total) as total_amount,
    SUM(amount_received) as total_received,
    SUM(outstanding_balance) as total_outstanding,
    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_sales,
    COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_sales,
    COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) as partial_sales
FROM active_sales;

-- Recent activity view
CREATE VIEW recent_activity AS
SELECT 
    s.id,
    s.customer,
    s.total,
    s.payment_status,
    s.created_at,
    s.updated_at,
    d.device_name,
    d.device_type
FROM sales s
LEFT JOIN devices d ON s.device_id = d.device_id
WHERE s.is_deleted = FALSE
ORDER BY s.updated_at DESC
LIMIT 50;

-- Pending sync view
CREATE VIEW pending_sync AS
SELECT *
FROM sales
WHERE sync_status = 'pending'
ORDER BY updated_at ASC;

-- Functions for data operations

-- Function to register a device
CREATE OR REPLACE FUNCTION register_device(
    p_device_id VARCHAR(255),
    p_device_name VARCHAR(255) DEFAULT NULL,
    p_device_type VARCHAR(50) DEFAULT 'unknown',
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    device_uuid UUID;
BEGIN
    INSERT INTO devices (device_id, device_name, device_type, user_agent)
    VALUES (p_device_id, p_device_name, p_device_type, p_user_agent)
    ON CONFLICT (device_id) DO UPDATE SET
        last_seen_at = CURRENT_TIMESTAMP,
        is_active = TRUE
    RETURNING id INTO device_uuid;
    
    RETURN device_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to soft delete a sale
CREATE OR REPLACE FUNCTION soft_delete_sale(
    p_sale_id UUID,
    p_device_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE sales
    SET 
        is_deleted = TRUE,
        deleted_at = CURRENT_TIMESTAMP,
        device_id = p_device_id,
        sync_status = 'pending'
    WHERE id = p_sale_id AND is_deleted = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to resolve conflicts using last-write-wins strategy
CREATE OR REPLACE FUNCTION resolve_conflict_last_write_wins(
    p_conflict_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    conflict_record conflicts%ROWTYPE;
    latest_data JSONB;
BEGIN
    SELECT * INTO conflict_record FROM conflicts WHERE id = p_conflict_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Choose the data with the latest timestamp
    IF (conflict_record.data_1->>'updated_at')::timestamp > (conflict_record.data_2->>'updated_at')::timestamp THEN
        latest_data := conflict_record.data_1;
    ELSE
        latest_data := conflict_record.data_2;
    END IF;
    
    -- Update the conflicts table
    UPDATE conflicts
    SET 
        resolution_data = latest_data,
        resolution_strategy = 'last_write_wins',
        resolved_at = CURRENT_TIMESTAMP,
        is_resolved = TRUE
    WHERE id = p_conflict_id;
    
    -- Update the actual record
    UPDATE sales
    SET 
        product = latest_data->>'product',
        quantity = (latest_data->>'quantity')::decimal,
        price = (latest_data->>'price')::decimal,
        total = (latest_data->>'total')::decimal,
        customer = latest_data->>'customer',
        notes = latest_data->>'notes',
        payment_status = latest_data->>'payment_status',
        payment_method = latest_data->>'payment_method',
        amount_received = (latest_data->>'amount_received')::decimal,
        sync_status = 'synced'
    WHERE id = conflict_record.record_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Initial data setup

-- Insert default device for local development
INSERT INTO devices (device_id, device_name, device_type) 
VALUES ('local-dev', 'Development Device', 'desktop')
ON CONFLICT (device_id) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO banana_sales_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO banana_sales_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO banana_sales_user;

-- Comments for documentation
COMMENT ON TABLE sales IS 'Main sales records with multi-device sync support';
COMMENT ON TABLE devices IS 'Device registration and tracking for synchronization';
COMMENT ON TABLE sync_log IS 'Audit log for all synchronization operations';
COMMENT ON TABLE conflicts IS 'Conflict detection and resolution tracking';

COMMENT ON COLUMN sales.version IS 'Optimistic locking version for conflict detection';
COMMENT ON COLUMN sales.device_id IS 'Device that last modified this record';
COMMENT ON COLUMN sales.sync_status IS 'Current synchronization status of the record';
COMMENT ON COLUMN sales.outstanding_balance IS 'Automatically calculated remaining balance';

-- Performance monitoring queries (for development/debugging)

-- Query to check index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- Query to check table sizes
-- SELECT 
--     schemaname,
--     tablename,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;