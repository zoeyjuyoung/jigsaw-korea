"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && anon);

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anon!, {
      realtime: {
        params: { eventsPerSecond: 40 },
      },
    })
  : null;
