
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../server/finanzas.db');
const db = new sqlite3.Database(dbPath);

console.log(`Checking database at ${dbPath}...`);

db.serialize(() => {
  // 1. Check party_members for guest_name
  db.all(`PRAGMA table_info(party_members)`, (err, rows) => {
    if (err) {
      console.error('Error checking party_members:', err);
      return;
    }
    const hasGuestName = rows.some(r => r.name === 'guest_name');
    if (!hasGuestName) {
      console.log('Adding guest_name column to party_members...');
      db.run(`ALTER TABLE party_members ADD COLUMN guest_name TEXT`, (err) => {
        if (err) console.error('Error adding guest_name:', err);
        else console.log('Successfully added guest_name.');
      });
    } else {
      console.log('party_members already has guest_name.');
    }
  });

  // 2. Check party_installment_plans for participants
  db.all(`PRAGMA table_info(party_installment_plans)`, (err, rows) => {
    if (err) {
      console.error('Error checking party_installment_plans:', err);
      return;
    }
    
    if (rows.length === 0) {
        console.log('party_installment_plans table does not exist. It will be created by the server.');
        return;
    }

    const hasParticipants = rows.some(r => r.name === 'participants');
    if (!hasParticipants) {
      console.log('Adding participants column to party_installment_plans...');
      db.run(`ALTER TABLE party_installment_plans ADD COLUMN participants TEXT`, (err) => {
        if (err) console.error('Error adding participants:', err);
        else console.log('Successfully added participants.');
      });
    } else {
      console.log('party_installment_plans already has participants.');
    }

    // Check for schema mismatch (old table with 'name' instead of 'description')
    const hasName = rows.some(r => r.name === 'name');
    const hasDescription = rows.some(r => r.name === 'description');
    
    if (hasName && !hasDescription) {
        console.log('Detected old schema for party_installment_plans (has name, missing description). Fixing...');
        // Rename and recreate
        db.serialize(() => {
            db.run(`ALTER TABLE party_installment_plans RENAME TO party_installment_plans_old`);
            db.run(`
              CREATE TABLE party_installment_plans (
                id TEXT PRIMARY KEY,
                party_id TEXT NOT NULL,
                description TEXT NOT NULL,
                total_amount REAL NOT NULL,
                installments_count INTEGER NOT NULL,
                installment_amount REAL NOT NULL,
                payer_id TEXT NOT NULL,
                debtor_id TEXT,
                start_date TEXT NOT NULL,
                created_by TEXT NOT NULL,
                participants TEXT,
                FOREIGN KEY(party_id) REFERENCES parties(id) ON DELETE CASCADE
              )
            `);
            // Migrate data
            db.run(`
              INSERT INTO party_installment_plans (id, party_id, description, total_amount, installments_count, installment_amount, payer_id, debtor_id, start_date, created_by, participants)
              SELECT id, party_id, name, total_amount, installments_count, installment_amount, payer_id, debtor_id, start_date, 'system', participants
              FROM party_installment_plans_old
            `);
            db.run(`DROP TABLE party_installment_plans_old`);
            console.log('Schema fixed.');
        });
    }
  });
});

db.close();
