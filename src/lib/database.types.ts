export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      trip_members: {
        Row: { created_at: string; email: string; role: string; trip_id: string };
        Insert: { created_at?: string; email: string; role?: string; trip_id: string };
        Update: { created_at?: string; email?: string; role?: string; trip_id?: string };
        Relationships: [{
          foreignKeyName: 'trip_members_trip_id_fkey';
          columns: ['trip_id'];
          isOneToOne: false;
          referencedRelation: 'trips';
          referencedColumns: ['id'];
        }];
      };
      trips: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
          state: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_id: string;
          state: Json;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
          state?: Json;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
