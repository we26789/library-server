"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect to the first available page based on role
      if (user.role === "student") {
        router.replace("/dashboard/borrows");
      } else if (user.role === "teacher") {
        router.replace("/dashboard/books");
      } else {
        router.replace("/dashboard/books");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-muted-foreground">正在跳转...</div>
    </div>
  );
}
