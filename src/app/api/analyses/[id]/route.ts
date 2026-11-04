import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const {error}=await supabase.from("analyses").delete().eq("id",id).eq("user_id",user.id);return error?NextResponse.json({error:error.message},{status:500}):new NextResponse(null,{status:204});}
