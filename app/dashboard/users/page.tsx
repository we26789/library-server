"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  Upload,
  Download,
  Search,
  Users,
  GraduationCap,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Student {
  no: string;
  name: string;
  gender: string;
  college: string;
  education: string;
  grade: string;
  major: string;
  is_abnormal: boolean;
}

interface Teacher {
  no: string;
  name: string;
  gender: string;
  college: string;
  is_abnormal: boolean;
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<"students" | "teachers">("students");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: students, isLoading: loadingStudents } = useSWR<Student[]>("/api/students", fetcher);
  const { data: teachers, isLoading: loadingTeachers } = useSWR<Teacher[]>("/api/teachers", fetcher);

  const filteredStudents = students?.filter(
    (s) =>
      s.name.includes(searchTerm) ||
      s.no.includes(searchTerm) ||
      s.college.includes(searchTerm)
  );

  const filteredTeachers = teachers?.filter(
    (t) =>
      t.name.includes(searchTerm) ||
      t.no.includes(searchTerm) ||
      t.college.includes(searchTerm)
  );

  const handleImportStudents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await api<{ success: number; errors: string[] }>(
          "/api/students/import",
          "POST",
          { csvText: ev.target?.result }
        );
        let msg = `成功导入 ${res.success} 条学生记录`;
        if (res.errors?.length) {
          msg += "\n部分失败：" + res.errors.join("；");
        }
        alert(msg);
        mutate("/api/students");
      } catch (err) {
        alert(err instanceof Error ? err.message : "导入失败");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImportTeachers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await api<{ success: number; errors: string[] }>(
          "/api/teachers/import",
          "POST",
          { csvText: ev.target?.result }
        );
        let msg = `成功导入 ${res.success} 条教师记录`;
        if (res.errors?.length) {
          msg += "\n部分失败：" + res.errors.join("；");
        }
        alert(msg);
        mutate("/api/teachers");
      } catch (err) {
        alert(err instanceof Error ? err.message : "导入失败");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-foreground">校园人员管理</h2>
          <p className="text-muted-foreground mt-1">管理学生和教师信息</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-xl font-medium hover:bg-foreground/90 transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            导入学生
            <input
              type="file"
              accept=".csv"
              onChange={handleImportStudents}
              className="hidden"
            />
          </label>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all cursor-pointer">
            <Upload className="w-4 h-4" />
            导入教师
            <input
              type="file"
              accept=".csv"
              onChange={handleImportTeachers}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Download Templates */}
      <div className="flex flex-wrap gap-3">
        <a
          href="data:text/csv;charset=utf-8,姓名,性别,学号,学院,学历,年级,专业,身份证号%0A张三,男,2024001,计算机学院,本科生,2024级,软件工程,440101200601011234"
          download="学生信息模板.csv"
          className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground rounded-xl text-sm hover:bg-secondary transition-all"
        >
          <Download className="w-4 h-4" />
          下载学生模板
        </a>
        <a
          href="data:text/csv;charset=utf-8,姓名,性别,工号,学院,身份证号%0A王建国,男,TEA001,工学院,440101198501011111"
          download="教师信息模板.csv"
          className="flex items-center gap-2 px-4 py-2 border border-border text-muted-foreground rounded-xl text-sm hover:bg-secondary transition-all"
        >
          <Download className="w-4 h-4" />
          下载教师模板
        </a>
      </div>

      {/* Notice */}
      <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 text-sm text-foreground/80">
        导入后学生/教师可用学号/工号登录，密码为身份证后6位
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "学生总数", value: students?.length || 0, icon: User },
          { label: "教师总数", value: teachers?.length || 0, icon: GraduationCap },
          { label: "学生正常", value: students?.filter((s) => !s.is_abnormal).length || 0, color: "text-success" },
          { label: "学生异常", value: students?.filter((s) => s.is_abnormal).length || 0, color: "text-destructive" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-card rounded-2xl p-5 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                {Icon && <Icon className="w-4 h-4" />}
                {stat.label}
              </div>
              <div className={cn("text-3xl font-serif mt-2", stat.color || "text-foreground")}>
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("students")}
          className={cn(
            "px-6 py-3 font-medium transition-all border-b-2 -mb-px",
            activeTab === "students"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <User className="w-4 h-4 inline mr-2" />
          学生列表
        </button>
        <button
          onClick={() => setActiveTab("teachers")}
          className={cn(
            "px-6 py-3 font-medium transition-all border-b-2 -mb-px",
            activeTab === "teachers"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <GraduationCap className="w-4 h-4 inline mr-2" />
          教师列表
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索姓名、学号/工号或学院..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
        />
      </div>

      {/* Tables */}
      {activeTab === "students" ? (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">学号</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">姓名</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">性别</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">学院</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">学历</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">年级</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">专业</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">借阅状态</th>
                </tr>
              </thead>
              <tbody>
                {loadingStudents ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredStudents?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      暂无学生数据
                    </td>
                  </tr>
                ) : (
                  filteredStudents?.map((student) => (
                    <tr key={student.no} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-foreground">{student.no}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{student.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{student.gender}</td>
                      <td className="px-6 py-4 text-muted-foreground">{student.college}</td>
                      <td className="px-6 py-4 text-muted-foreground">{student.education}</td>
                      <td className="px-6 py-4 text-muted-foreground">{student.grade}</td>
                      <td className="px-6 py-4 text-muted-foreground">{student.major}</td>
                      <td className="px-6 py-4">
                        {student.is_abnormal ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 text-destructive rounded-lg text-sm font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            异常
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 text-success rounded-lg text-sm font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            正常
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">工号</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">姓名</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">性别</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">学院</th>
                  <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">借阅状态</th>
                </tr>
              </thead>
              <tbody>
                {loadingTeachers ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredTeachers?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      暂无教师数据
                    </td>
                  </tr>
                ) : (
                  filteredTeachers?.map((teacher) => (
                    <tr key={teacher.no} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-foreground">{teacher.no}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{teacher.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">{teacher.gender}</td>
                      <td className="px-6 py-4 text-muted-foreground">{teacher.college}</td>
                      <td className="px-6 py-4">
                        {teacher.is_abnormal ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 text-destructive rounded-lg text-sm font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            异常
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 text-success rounded-lg text-sm font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            正常
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
