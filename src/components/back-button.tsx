"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  return <button className="nav-button back-button" type="button" onClick={() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }}><span aria-hidden="true">←</span> Back</button>;
}
