import Database from "better-sqlite3";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
}

export function makeUserRepo(db: Database.Database) {
  const findByEmail = (email: string): UserRow | undefined => {
    return db
      .prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?")
      .get(email);
  };

  const findById = async (id: number): Promise<UserRow> => {
    const row = db
      .prepare<[number], UserRow>("SELECT * FROM users WHERE id = ?")
      .get(id);
    if (!row) throw new Error(`User ${id} not found`);
    return row;
  };

  return { findByEmail, findById };
}

export type UserRepo = ReturnType<typeof makeUserRepo>;
