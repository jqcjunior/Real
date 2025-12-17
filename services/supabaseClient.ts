
import { createClient } from '@supabase/supabase-js';

// Credentials provided by user
const supabaseUrl = 'https://rwwomakjhmglgoowbmsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3d29tYWtqaG1nbGdvb3dibXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NzM3NzUsImV4cCI6MjA4MTU0OTc3NX0.f-FbwrnnlUFermnqLUyPHpT-EoUEc1dzXTlV4cXyQ28';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
