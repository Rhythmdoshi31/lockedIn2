"use client";
import { useRouter } from "next/navigation";
export function DeleteAnalysisButton({id}:{id:string}){const router=useRouter();return <button className="delete-action" type="button" onClick={async(e)=>{e.preventDefault();e.stopPropagation();if(!confirm("Delete this saved analysis?"))return;const r=await fetch(`/api/analyses/${id}`,{method:"DELETE"});if(r.ok)router.refresh();}}>Delete</button>}
