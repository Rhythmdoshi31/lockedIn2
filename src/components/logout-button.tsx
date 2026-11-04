"use client";
import { createClient } from "@/lib/supabase/client";
export function LogoutButton(){return <button className="secondary-button" onClick={async()=>{await createClient().auth.signOut();location.href="/"}}>Log out</button>}
