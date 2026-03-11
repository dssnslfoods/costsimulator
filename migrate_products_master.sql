-- Migration: Add item_group and item_country to products_master
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/tonodxdzgidlbwqnsbsx/sql/new

ALTER TABLE products_master ADD COLUMN IF NOT EXISTS item_group TEXT;
ALTER TABLE products_master ADD COLUMN IF NOT EXISTS item_country TEXT;
