"use client";

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  Plus,
  Upload,
  Download,
  Trash2,
  Search,
  BookOpen,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CATE_DATA } from "@/lib/categories";
import { cn } from "@/lib/utils";

interface Book {
  book_code: string;
  cate_code: string;
  isbn: string;
  name: string;
  author: string;
  publisher: string;
  price: number;
  state: number;
  borrow_user_no: string | null;
  borrow_user_name: string | null;
  remark: string | null;
}

const stateMap: Record<number, { label: string; className: string }> = {
  0: { label: "在馆", className: "bg-success/10 text-success" },
  1: { label: "已借出", className: "bg-warning/10 text-warning" },
  2: { label: "已丢失", className: "bg-destructive/10 text-destructive" },
  3: { label: "自然损坏", className: "bg-muted text-muted-foreground" },
  4: { label: "人为损坏", className: "bg-destructive/10 text-destructive" },
};

export default function BooksPage() {
  const { user } = useAuth();
  const { data: books, isLoading } = useSWR<Book[]>("/api/books", fetcher);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredBooks = books?.filter(
    (book) =>
      book.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.book_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (bookCode: string) => {
    if (!confirm("确认删除该图书？")) return;
    try {
      await api(`/api/books/${encodeURIComponent(bookCode)}`, "DELETE");
      mutate("/api/books");
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await api<{ count: number; errors: string[] }>(
          "/api/books/import",
          "POST",
          { csvText: ev.target?.result }
        );
        let msg = `成功导入 ${res.count} 本图书`;
        if (res.errors?.length) {
          msg += "\n部分失败：\n" + res.errors.join("\n");
        }
        alert(msg);
        mutate("/api/books");
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
          <h2 className="text-2xl font-serif text-foreground">图书信息管理</h2>
          <p className="text-muted-foreground mt-1">管理馆藏图书信息</p>
        </div>
        {user?.role === "admin" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-xl font-medium hover:bg-foreground/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              添加图书
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-xl font-medium hover:bg-secondary/80 transition-all cursor-pointer">
              <Upload className="w-4 h-4" />
              导入CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <a
              href="data:text/csv;charset=utf-8,分类号,书名,作者,出版社,ISBN,定价%0AA1,马克思主义哲学原理,陈先达,人民出版社,9787010001001,45.0"
              download="图书导入模板.csv"
              className="flex items-center gap-2 px-4 py-2.5 border border-border text-foreground rounded-xl font-medium hover:bg-secondary transition-all"
            >
              <Download className="w-4 h-4" />
              下载模板
            </a>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索书名、作者或编码..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "总藏书", value: books?.length || 0, color: "bg-foreground" },
          { label: "在馆", value: books?.filter((b) => b.state === 0).length || 0, color: "bg-success" },
          { label: "已借出", value: books?.filter((b) => b.state === 1).length || 0, color: "bg-warning" },
          { label: "异常", value: books?.filter((b) => b.state > 1).length || 0, color: "bg-destructive" },
        ].map((stat, i) => (
          <div key={i} className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", stat.color)} />
              <span className="text-muted-foreground text-sm">{stat.label}</span>
            </div>
            <div className="text-3xl font-serif text-foreground mt-2">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">馆藏编码</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">分类号</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">书名</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">作者</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">出版社</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">定价</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">状态</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">借阅人</th>
                {user?.role === "admin" && (
                  <th className="text-right px-6 py-4 font-medium text-foreground/70 text-sm">操作</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredBooks?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    暂无图书数据
                  </td>
                </tr>
              ) : (
                filteredBooks?.map((book) => (
                  <tr key={book.book_code} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-foreground">{book.book_code}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-accent/10 text-accent rounded-lg text-sm font-medium">
                        {book.cate_code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">{book.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{book.author}</td>
                    <td className="px-6 py-4 text-muted-foreground">{book.publisher || "-"}</td>
                    <td className="px-6 py-4 text-foreground">{book.price ? `¥${book.price}` : "-"}</td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-lg text-sm font-medium", stateMap[book.state]?.className)}>
                        {stateMap[book.state]?.label || "未知"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {book.borrow_user_name ? `${book.borrow_user_name} (${book.borrow_user_no})` : "-"}
                    </td>
                    {user?.role === "admin" && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(book.book_code)}
                          disabled={book.state === 1}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Book Modal */}
      {showAddModal && (
        <AddBookModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

function AddBookModal({ onClose }: { onClose: () => void }) {
  const [cateLevel1, setCateLevel1] = useState("A");
  const [cateLevel2, setCateLevel2] = useState("");
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [isbn, setIsbn] = useState("");
  const [price, setPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !author.trim() || !cateLevel2.trim()) {
      alert("请填写必填项");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api<{ bookCode: string }>("/api/books", "POST", {
        cateCode: cateLevel2,
        name,
        author,
        publisher,
        isbn,
        price: price ? parseFloat(price) : 0,
      });
      alert(`入库成功，馆藏编码：${res.bookCode}`);
      mutate("/api/books");
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "入库失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h3 className="text-xl font-serif text-foreground">添加新图书</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                一级大类
              </label>
              <select
                value={cateLevel1}
                onChange={(e) => {
                  setCateLevel1(e.target.value);
                  setCateLevel2("");
                }}
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              >
                {Object.entries(CATE_DATA).map(([code, data]) => (
                  <option key={code} value={code}>
                    {code} - {data.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                二级分类号 <span className="text-destructive">*</span>
              </label>
              <select
                value={cateLevel2}
                onChange={(e) => setCateLevel2(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              >
                <option value="">请选择</option>
                {Object.entries(CATE_DATA[cateLevel1]?.children || {}).map(([code, label]) => (
                  <option key={code} value={code}>
                    {code} - {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                书名 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入书名"
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                作者 <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="请输入作者"
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                出版社
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="出版社名称"
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                ISBN
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="13位ISBN"
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                定价
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-border text-foreground rounded-xl font-medium hover:bg-secondary transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl font-medium hover:bg-foreground/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  确认入库
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
