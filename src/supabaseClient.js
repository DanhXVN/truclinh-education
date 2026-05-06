import { createClient } from '@supabase/supabase-js'

// Bạn lấy 2 thông số này ở trang Supabase (Settings -> API)
const supabaseUrl = 'https://cpwnpnxqbjaduwdualmz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwd25wbnhxYmphZHV3ZHVhbG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzMwNTUsImV4cCI6MjA5MzQwOTA1NX0.GNzau0B414FDRy28PvNBgxrpkvfkqtcxj7FJKEGMklE'

export const supabase = createClient(supabaseUrl, supabaseKey)