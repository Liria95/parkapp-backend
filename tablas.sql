-- ============================================
-- BASE DE DATOS PARKAPP - SCHEMA DEFINITIVO
-- ============================================

-- TABLA: users (Usuarios del sistema)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLA: vehicles (Vehículos de usuarios)
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    license_plate VARCHAR(20) NOT NULL,
    UNIQUE(user_id, license_plate)
);

-- TABLA: street_parking (Zonas amplias - ej: "Zona Centro", "Microcentro")
CREATE TABLE street_parking (
    id SERIAL PRIMARY KEY,
    zone_name VARCHAR(100) NOT NULL
);

-- TABLA: street (Cuadras con rangos geográficos)
CREATE TABLE street (
    id SERIAL PRIMARY KEY,
    street_parking_id INTEGER NOT NULL REFERENCES street_parking(id) ON DELETE CASCADE,
    street_address VARCHAR(200) NOT NULL,
    lat_min DECIMAL(10, 8) NOT NULL,
    lat_max DECIMAL(10, 8) NOT NULL,
    lng_min DECIMAL(11, 8) NOT NULL,
    lng_max DECIMAL(11, 8) NOT NULL,
    total_spaces INTEGER NOT NULL,
    available_spaces INTEGER NOT NULL
);

-- TABLA: parking_spaces (Espacios individuales)
CREATE TABLE parking_spaces (
    id SERIAL PRIMARY KEY,
    street_id INTEGER NOT NULL REFERENCES street(id) ON DELETE CASCADE,
    space_code VARCHAR(20) UNIQUE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'available'
);

-- TABLA: price (Tarifas por calle)
CREATE TABLE price (
    id SERIAL PRIMARY KEY,
    street_id INTEGER NOT NULL REFERENCES street(id) ON DELETE CASCADE,
    fee DECIMAL(10, 2) NOT NULL
);

-- TABLA: parking_sessions (Sesiones de estacionamiento)
CREATE TABLE parking_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    parking_space_id INTEGER NOT NULL REFERENCES parking_spaces(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

-- TABLA: transactions (Movimientos de saldo)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLA: fines (Multas/Infracciones)
CREATE TABLE fines (
    id SERIAL PRIMARY KEY,
    parking_session_id INTEGER NOT NULL REFERENCES parking_sessions(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

-- TABLA: notifications (Notificaciones)
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parking_session_id INTEGER REFERENCES parking_sessions(id) ON DELETE SET NULL,
    fines_id INTEGER REFERENCES fines(id) ON DELETE SET NULL,
    notification_time TIME NOT NULL,
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_street_parking_id ON street(street_parking_id);
CREATE INDEX idx_street_coordinates ON street(lat_min, lat_max, lng_min, lng_max);
CREATE INDEX idx_parking_spaces_street_id ON parking_spaces(street_id);
CREATE INDEX idx_parking_spaces_status ON parking_spaces(status);
CREATE INDEX idx_parking_spaces_code ON parking_spaces(space_code);
CREATE INDEX idx_price_street_id ON price(street_id);
CREATE INDEX idx_parking_sessions_user_id ON parking_sessions(user_id);
CREATE INDEX idx_parking_sessions_space_id ON parking_sessions(parking_space_id);
CREATE INDEX idx_parking_sessions_status ON parking_sessions(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_fines_session_id ON fines(parking_session_id);
CREATE INDEX idx_fines_status ON fines(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ============================================
-- TRIGGERS PARA ACTUALIZAR ESPACIOS DISPONIBLES
-- ============================================

-- Cuando se inicia una sesión
CREATE OR REPLACE FUNCTION update_space_on_start()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE parking_spaces 
    SET status = 'occupied' 
    WHERE id = NEW.parking_space_id;
    
    UPDATE street 
    SET available_spaces = available_spaces - 1
    WHERE id = (SELECT street_id FROM parking_spaces WHERE id = NEW.parking_space_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_start_parking
AFTER INSERT ON parking_sessions
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION update_space_on_start();

-- Cuando termina una sesión
CREATE OR REPLACE FUNCTION update_space_on_end()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'active' AND NEW.status IN ('completed', 'expired') THEN
        UPDATE parking_spaces 
        SET status = 'available' 
        WHERE id = NEW.parking_space_id;
        
        UPDATE street 
        SET available_spaces = available_spaces + 1
        WHERE id = (SELECT street_id FROM parking_spaces WHERE id = NEW.parking_space_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_end_parking
AFTER UPDATE ON parking_sessions
FOR EACH ROW
EXECUTE FUNCTION update_space_on_end();