export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number
          category_id: string
          deleted_at: string | null
          id: string
          month: string
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          deleted_at?: string | null
          id?: string
          month: string
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          deleted_at?: string | null
          id?: string
          month?: string
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_custom: boolean
          name: string
          revision: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          is_custom?: boolean
          name: string
          revision?: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_custom?: boolean
          name?: string
          revision?: number
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          note: string
          revision: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          date: string
          deleted_at?: string | null
          id?: string
          note?: string
          revision?: number
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string
          revision?: number
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      transaction_type: "income" | "expense"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<TTableName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TTableName]["Row"]

export type TablesInsert<TTableName extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][TTableName]["Insert"]

export const Constants = {
  public: {
    Enums: {
      transaction_type: ["income", "expense"],
    },
  },
} as const
