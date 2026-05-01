"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, User, GraduationCap, Shield, ArrowRight, Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function LoginForm() {
  const [role, setRole] = useState<"admin" | "teacher" | "student">("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("请输入账号和密码");
      return;
    }

    setIsLoading(true);
    try {
      await login(role, username, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = [
    { value: "admin", label: "管理员", icon: Shield, desc: "系统管理" },
    { value: "teacher", label: "教师", icon: GraduationCap, desc: "教职工" },
    { value: "student", label: "学生", icon: User, desc: "在校学生" },
  ] as const;

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground text-background flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-foreground" />
            </div>
            <span className="text-xl font-medium tracking-tight">图书馆</span>
          </div>
        </div>
        
        <div className="space-y-6">
          <h1 className="text-5xl font-serif leading-tight text-balance">
            知识的殿堂
            <br />
            <span className="text-accent">智慧的源泉</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
            现代化图书管理系统，为校园提供便捷高效的图书借阅服务
          </p>
        </div>

        <div className="flex items-center gap-8 text-sm text-muted-foreground">
          <div>
            <div className="text-3xl font-serif text-background">50,000+</div>
            <div>馆藏图书</div>
          </div>
          <div className="w-px h-12 bg-border" />
          <div>
            <div className="text-3xl font-serif text-background">10,000+</div>
            <div>注册用户</div>
          </div>
          <div className="w-px h-12 bg-border" />
          <div>
            <div className="text-3xl font-serif text-background">24/7</div>
            <div>在线服务</div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-foreground rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-background" />
            </div>
            <span className="text-xl font-medium tracking-tight">图书馆</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-serif mb-2">欢迎回来</h2>
            <p className="text-muted-foreground">请选择身份并登录系统</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Role Selection */}
            <div className="grid grid-cols-3 gap-3">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 text-center ${
                      role === option.value
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/30 bg-card"
                    }`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-2 ${role === option.value ? "text-accent" : ""}`} />
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className={`text-xs mt-1 ${role === option.value ? "text-background/70" : "text-muted-foreground"}`}>
                      {option.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Input Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">
                  {role === "admin" ? "管理员账号" : role === "teacher" ? "教师工号" : "学生学号"}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={role === "admin" ? "请输入管理员账号" : role === "teacher" ? "请输入工号" : "请输入学号"}
                  className="w-full px-4 py-3.5 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-foreground/80">
                  {role === "admin" ? "管理员密码" : "密码（身份证后6位）"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3.5 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-destructive text-sm bg-destructive/10 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-foreground text-background rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-foreground/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  登录系统
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 p-4 bg-secondary rounded-xl">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">演示账号：</span>
              管理员 admin / 123456
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
