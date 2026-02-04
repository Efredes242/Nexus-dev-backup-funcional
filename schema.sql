-- Nexus Finance - Consolidated Schema (V1.1)
-- This file includes all tables and columns required for the current codebase.

DROP TABLE IF EXISTS installment_plans;
DROP TABLE IF EXISTS member_nicknames;
DROP TABLE IF EXISTS party_expenses;
DROP TABLE IF EXISTS party_members;
DROP TABLE IF EXISTS parties;
DROP TABLE IF EXISTS category_budgets;
DROP TABLE IF EXISTS user_configs;
DROP TABLE IF EXISTS installments;
DROP TABLE IF EXISTS goals;
DROP TABLE IF EXISTS entries;
DROP TABLE IF EXISTS users;

-- Users Table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'user',
  must_change_password INTEGER DEFAULT 0,
  email TEXT,
  google_id TEXT,
  avatar TEXT,
  firstName TEXT,
  lastName TEXT,
  birthDate TEXT
);

-- Entries Table (Expenses/Incomes)
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  name TEXT,
  amount REAL,
  category TEXT,
  tag TEXT,
  date TEXT,
  status TEXT,
  paymentMethod TEXT,
  month_year TEXT,
  cardName TEXT,
  financingPlan TEXT,
  originalAmount REAL,
  currency TEXT,
  exchangeRateEstimated REAL,
  exchangeRateActual REAL,
  is_provisional INTEGER DEFAULT 0,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Goals Table
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  name TEXT,
  targetAmount REAL,
  currentAmount REAL,
  deadline TEXT,
  icon TEXT,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Installments Table (Individual)
CREATE TABLE installments (
  id TEXT PRIMARY KEY,
  name TEXT,
  totalAmount REAL,
  installments INTEGER,
  startDate TEXT,
  description TEXT,
  category TEXT,
  cardName TEXT,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- User Configs
CREATE TABLE user_configs (
  user_id TEXT PRIMARY KEY,
  currency TEXT,
  categories TEXT,
  creditCards TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Category Budgets
CREATE TABLE category_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category TEXT,
  amount REAL,
  UNIQUE(user_id, category),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Parties (Groups)
CREATE TABLE parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    description TEXT
);

-- Party Members
CREATE TABLE party_members (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    user_id TEXT, -- Nullable for guests
    status TEXT NOT NULL, -- 'pending', 'accepted', 'rejected'
    invited_email TEXT,
    joined_at TEXT NOT NULL,
    is_guest INTEGER DEFAULT 0,
    guest_name TEXT,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

-- Party Expenses
CREATE TABLE party_expenses (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    payer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT,
    participants TEXT, -- JSON array of user_ids
    installments_count INTEGER DEFAULT 1,
    card_name TEXT,
    first_payment_date TEXT,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

-- Member Nicknames
CREATE TABLE member_nicknames (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    party_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    UNIQUE(user_id, party_id, member_id),
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

-- Installment Plans (Group)
CREATE TABLE installment_plans (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL,
    description TEXT NOT NULL,
    total_amount REAL NOT NULL,
    installments_count INTEGER NOT NULL,
    installment_amount REAL NOT NULL,
    payer_id TEXT NOT NULL,
    debtor_id TEXT NOT NULL,
    participants TEXT, -- JSON array of participant IDs
    start_date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT,
    FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
);

-- Indices
CREATE INDEX idx_party_members_user ON party_members(user_id);
CREATE INDEX idx_party_expenses_party ON party_expenses(party_id);
CREATE INDEX idx_entries_user ON entries(user_id);
CREATE INDEX idx_goals_user ON goals(user_id);
