"use client";
import { createClient } from "@/lib/supabase/client";
export function LogoutButton(){return <button className="secondary-button" onClick={async()=>{const {error}=await createClient().auth.signOut({scope:"global"});if(!error)location.href="/"}}>Log out</button>}
