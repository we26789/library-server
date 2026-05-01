"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import {
  Search,
  BookOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info,
  CreditCard,
} from "lucide-react";
import { api, fetcher } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn, formatDate } from "@/lib/utils";

interface BorrowRecord {
  id: number;
  book_code: string;
  book_name: string;
  user_no: string;
  user_name: string;
  user_role: string;
  borrow_time: string;
  deadline: string;
  return_time: string | null;
  overdue_days: number;
  fine: number;
  fine_paid: boolean;
  state: number;
  renew_times: number;
  currentOverdueDays: number;
  currentFine: number;
}

interface BookSearchResult {
  book_code: string;
  name: string;
  author: string;
  cate_code: string;
}

export default function BorrowsPage() {
  const { user } = useAuth();
  const { data: records, isLoading } = useSWR<BorrowRecord[]>("/api/borrows", fetcher);
  
  const [bookCode, setBookCode] = useState("");
  const [userNo, setUserNo] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Set user number for non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      setUserNo(user.no);
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Book search with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchKeyword.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api<BookSearchResult[]>(
          `/api/books/search?keyword=${encodeURIComponent(searchKeyword)}`
        );
        setSearchResults(results);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchKeyword]);

  const selectBook = (book: BookSearchResult) => {
    setBookCode(book.book_code);
    setSearchKeyword("");
    setShowDropdown(false);
  };

  const handleBorrow = async () => {
    if (!bookCode.trim()) {
      alert("请输入或选择图书编码");
      return;
    }
    const targetUserNo = user?.role === "admin" ? userNo : user?.no;
    if (!targetUserNo) {
      alert("请输入借阅人学号/工号");
      return;
    }

    setIsProcessing(true);
    try {
      await api("/api/borrows/borrow", "POST", {
        bookCode: bookCode.trim(),
        userNo: targetUserNo,
      });
      alert("借书成功");
      setBookCode("");
      mutate("/api/borrows");
    } catch (err) {
      alert(err instanceof Error ? err.message : "借书失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = async () => {
    if (!bookCode.trim()) {
      alert("请输入图书编码");
      return;
    }
    const targetUserNo = user?.role === "admin" ? userNo : user?.no;
    if (!targetUserNo) {
      alert("请输入借阅人学号/工号");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await api<{ overdueDays: number; fine: number }>(
        "/api/borrows/return",
        "POST",
        {
          bookCode: bookCode.trim(),
          userNo: targetUserNo,
        }
      );
      if (res.overdueDays > 0) {
        alert(`还书成功，超时 ${res.overdueDays} 天，罚款 ${res.fine} 元`);
      } else {
        alert("还书成功");
      }
      setBookCode("");
      mutate("/api/borrows");
    } catch (err) {
      alert(err instanceof Error ? err.message : "还书失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenew = async (bookCode: string, userNo: string) => {
    try {
      const res = await api<{ newDeadline: string; renewTimes: number }>(
        "/api/borrows/renew",
        "POST",
        { bookCode, userNo }
      );
      alert(`续借成功，新的最晚归还日期：${res.newDeadline}，已续借 ${res.renewTimes} 次`);
      mutate("/api/borrows");
    } catch (err) {
      alert(err instanceof Error ? err.message : "续借失败");
    }
  };

  const handlePayFine = async (recordId: number) => {
    try {
      await api("/api/borrows/payfine", "POST", { recordId });
      alert("罚款缴纳成功");
      mutate("/api/borrows");
    } catch (err) {
      alert(err instanceof Error ? err.message : "缴纳失败");
    }
  };

  const stats = {
    total: records?.length || 0,
    borrowing: records?.filter((r) => r.state === 1).length || 0,
    returned: records?.filter((r) => r.state === 0).length || 0,
    overdue: records?.filter((r) => r.state === 1 && r.currentOverdueDays > 0).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-serif text-foreground">图书借还管理</h2>
        <p className="text-muted-foreground mt-1">
          {user?.role === "admin" ? "管理所有借还记录" : "我的借阅记录"}
        </p>
      </div>

      {/* Rules Card */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="text-foreground">
              <span className="font-medium">借阅规则：</span>
              单次借阅期限30天，超时未还按每本每天0.1元收取罚款；有超时未还/未结清罚款的用户，禁止新的借书操作
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">续借规则：</span>
              每本书最多续借2次，每次续借延长30天（从原截止日期算起），逾期图书不可续借
            </p>
          </div>
        </div>
      </div>

      {/* Operation Card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-lg font-medium text-foreground mb-5">借还操作</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Book Code Input */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              馆藏编码
            </label>
            <input
              type="text"
              value={bookCode}
              onChange={(e) => setBookCode(e.target.value)}
              placeholder="输入编码或通过搜索选择"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
            />
          </div>

          {/* Book Search */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              按书名搜索
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="输入书名关键词"
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all"
              />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Search Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-60 overflow-auto">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    未找到在馆图书
                  </div>
                ) : (
                  searchResults.map((book) => (
                    <button
                      key={book.book_code}
                      onClick={() => selectBook(book)}
                      className="w-full px-4 py-3 flex justify-between items-center hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
                    >
                      <div>
                        <div className="font-medium text-foreground">{book.name}</div>
                        <div className="text-sm text-muted-foreground">{book.author}</div>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {book.book_code}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* User Input (Admin only) */}
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">
              借阅人（学号/工号）
            </label>
            <input
              type="text"
              value={userNo}
              onChange={(e) => setUserNo(e.target.value)}
              placeholder="输入学号或工号"
              disabled={user?.role !== "admin"}
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground transition-all disabled:bg-secondary disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleBorrow}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-xl font-medium hover:bg-foreground/90 transition-all disabled:opacity-50"
          >
            <ArrowDownToLine className="w-4 h-4" />
            借书登记
          </button>
          <button
            onClick={handleReturn}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-success text-success-foreground rounded-xl font-medium hover:bg-success/90 transition-all disabled:opacity-50"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            还书登记
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "总记录", value: stats.total, icon: BookOpen },
          { label: "借阅中", value: stats.borrowing, icon: Clock, color: "text-warning" },
          { label: "已归还", value: stats.returned, icon: CheckCircle, color: "text-success" },
          { label: "超期未还", value: stats.overdue, icon: AlertCircle, color: "text-destructive" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-card rounded-2xl p-5 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Icon className="w-4 h-4" />
                {stat.label}
              </div>
              <div className={cn("text-3xl font-serif mt-2", stat.color || "text-foreground")}>
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Records Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">馆藏编码</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">书名</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">借阅人</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">借阅时间</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">归还期限</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">归还时间</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">超时</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">罚款</th>
                <th className="text-left px-6 py-4 font-medium text-foreground/70 text-sm">续借</th>
                <th className="text-right px-6 py-4 font-medium text-foreground/70 text-sm">操作</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : records?.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    暂无借还记录
                  </td>
                </tr>
              ) : (
                records?.map((record) => {
                  const overdue = record.currentOverdueDays || 0;
                  const fine = record.currentFine || 0;
                  const canRenew =
                    record.state === 1 &&
                    overdue === 0 &&
                    record.renew_times < 2 &&
                    (user?.role === "admin" || user?.no === record.user_no);
                  const canPayFine =
                    user?.role === "admin" && !record.fine_paid && fine > 0;

                  return (
                    <tr key={record.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-foreground">{record.book_code}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{record.book_name}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {record.user_name} ({record.user_no})
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(record.borrow_time)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(record.deadline)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatDate(record.return_time)}</td>
                      <td className="px-6 py-4">
                        {overdue > 0 ? (
                          <span className="text-destructive font-medium">{overdue}天</span>
                        ) : (
                          <span className="text-muted-foreground">0天</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {fine > 0 ? (
                            <>
                              <span className="text-destructive font-medium">{fine}元</span>
                              {record.fine_paid ? (
                                <span className="px-2 py-0.5 bg-success/10 text-success text-xs rounded-md">
                                  已缴
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-md">
                                  未缴
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">0元</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {record.renew_times}/2
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canRenew && (
                            <button
                              onClick={() => handleRenew(record.book_code, record.user_no)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 transition-all"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              续借
                            </button>
                          )}
                          {canPayFine && (
                            <button
                              onClick={() => handlePayFine(record.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-lg text-sm font-medium hover:bg-success/20 transition-all"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              缴费
                            </button>
                          )}
                          {!canRenew && !canPayFine && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
