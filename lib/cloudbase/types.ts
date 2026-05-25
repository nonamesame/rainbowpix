export interface TcbUser {
  uid: string;
  email?: string;
  phone?: string;
  username?: string;
}

export interface UserProfile {
  uid: string;
  username?: string;
  email?: string;
  phone?: string;
  bio?: string;
  created_at?: string;
}
