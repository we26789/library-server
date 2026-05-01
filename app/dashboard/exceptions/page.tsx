"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  AlertTriangle,
  Trash2,
  RotateCcw,
  FileX,
  Info,
  Loader2,
  Check,
} from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

interface ExceptionRecord {
  id: number;
  book_code: string;
  type: string;
  price: number;
  description: string;
  handle_time: string;
  handle_user: string;
  state: string;
}

export default function ExceptionsPage() {
  const { data: exceptions, isLoading } = useSWR<ExceptionRecord[]>("/api/exceptions", fetcher);

  const [bookCode, setBookCode] = useState("");
  const [exType, setExType] = useState<"lost" | "nature" | "human">("lost");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRegister = async () => {
    if (!bookCode.trim()) {
      alert("请输入图书编码");
      return;
    }
    if ((exType === "lost" || exType === "human") && !price) {
      alert("丢失/人为损坏必须填写赔偿金额");
      return;
    }

    setIsProcessing(true);
    try {
      await api("/api/exceptions/register", "POST", {
        bookCode: bookCode.trim(),
        exType,
        exPrice: price ? parseFloat(price) : 0,
        exDesc: description,
      });
      alert("异常登记成功");
      clearForm();
      mutate("/api/exceptions");
      mutate("/api/books");
    } catch (err) {
      alert(err instanceof Error ? err.message : "登记失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!bookCode.trim()) {
      alert("请输入图书编码");
      return;
    }
    if (!confirm("确认注销该编码？该操作不可恢复")) {
      return;
    }

    setIsProcessing(true);
    try {
      await api("/api/exceptions/cancel", "POST", {
        bookCode: bookCode.trim(),
      });
      alert("注销成功");
      clearForm();
      mutate("/api/exceptions");
      mutate("/api/books");
    } catch (err) {
      alert(err instanceof Error ? err.message : "注销失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRecreate = async () => {
    if (!bookCode.trim()) {
      alert("请输入图书编码");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api<{ newCode: string }>(
        "/api/exceptions/recreate",
        "POST",
        { bookCode: bookCode.trim() }
      );
      alert(`重新入库成功，新编码：${res.newCode}`);
      clearForm();
      mutate("/api/exceptions");
      mutate("/api/books");
    } catch (err) {
      alert(err instanceof Error ? err.message : "重新入库失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearForm = () => {
    setBookCode("");
    setExType("lost");
    setPrice("");
    setDescription("");
  };

  const typeStats = {
    lost: exceptions?.filter((e) => e.type === "丢失").length || 0,
    nature: exceptions?.filter((e) => e.type === "自然损坏").length || 0,
    human: exceptions?.filter((e) => e.type === "人为损坏").length || 0,
    cancel: exceptions?.filter((e) => e.type === "编码注销").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif text-foreground">图书损坏/丢失处理</h2>
        <p className="text-muted-foreground mt-1">处理异常图书并记录</p>
      </div>

      {/* Rules Card */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="text-foreground">
              <span className="font-medium">处理规则：</span>
              自然损坏无需赔偿，人为损坏按原价赔偿
            </p>
            <p className="text-muted-foreground">
              丢失/损坏图书将被锁定，无法借出，完成处理后可注销编码或重新入库
            </p>
          </div>
        </div>
      </div>

      {/* Operation Card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-lg font-medium text-foreground mb-5">损坏/丢失登记</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Book Code */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              馆藏编码 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={bookCode}
              onChange={(e) => setBookCode(e.target.value)}
              placeholder="输入异常图书的馆藏编码"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
            />
          </div>

          {/* Exception Type */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              异常类型
            </label>
            <div className="flex gap-2">
              {[
                { value: "lost", label: "图书丢失", color: "destructive" },
                { value: "nature", label: "自然损坏", color: "muted" },
                { value: "human", label: "人为损坏", color: "warning" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setExType(option.value as "lost" | "nature" | "human")}
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-all text-sm",
                    exType === option.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:border-foreground/30"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              赔偿金额 {(exType === "lost" || exType === "human") && <span className="text-destructive">*</span>}
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={exType === "nature" ? "自然损坏无需赔偿" : "请输入赔偿金额"}
              disabled={exType === "nature"}
              min="0"
              step="0.01"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all disabled:bg-secondary disabled:cursor-not-allowed"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              损坏/丢失描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述异常情况"
              rows={1}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all resize-none"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={handleRegister}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-warning text-warning-foreground rounded-xl font-medium hover:bg-warning/90 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            异常登记
          </button>
          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-destructive text-destructive-foreground rounded-xl font-medium hover:bg-destructive/90 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            注销编码
          </button>
          <button
            onClick={handleRecreate}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-success text-success-foreground rounded-xl font-medium hover:bg-success/90 transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            重新入库
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "图书丢失", value: typeStats.lost, color: "text-destructive" },
          { label: "自然损坏", value: typeStats.nature, color: "text-muted-foreground" },
          { label: "人为损坏", value: typeStats.human, color: "text-warning" },
          { label: "编码注销", value: typeStats.cancel, color: "text-foreground" },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-2xl p-5 border border-border">
            <div className="text-muted-foreground text-sm">{stat.label}</div>
            <div className={cn("text-3xl font-serif mt-2", stat.color)}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Records Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="font-medium text-foreground">异常处理记录</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">馆藏编码</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">异常类型</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">赔偿金额</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">异常描述</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">处理时间</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">处理人</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">处理状态</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : exceptions?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <FileX className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    暂无异常记录
                  </td>
                </tr>
              ) : (
                exceptions?.map((ex) => (
                  <tr key={ex.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-foreground">{ex.book_code}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-sm font-medium",
                          ex.type === "丢失" && "bg-destructive/10 text-destructive",
                          ex.type === "自然损坏" && "bg-muted text-muted-foreground",
                          ex.type === "人为损坏" && "bg-warning/10 text-warning",
                          ex.type === "编码注销" && "bg-foreground/10 text-foreground",
                          ex.type === "重新入库" && "bg-success/10 text-success"
                        )}
                      >
                        {ex.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground">
                      {ex.price > 0 ? `¥${ex.price}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground max-w-xs truncate">
                      {ex.description || "-"}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{formatDate(ex.handle_time)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{ex.handle_user}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-success/10 text-success rounded-lg text-sm font-medium">
                        <Check className="w-3.5 h-3.5" />
                        {ex.state}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
