/**
 * 照片上传（UIUX §6.6 / §7.12 / REQ-08）：
 * - 入口瓦片 96×96：虚线描边 + 相机图标 + 「上传照片」
 * - ≤3 张上限（MAX_PHOTOS），达上限隐藏入口瓦片 + Footnote「最多 3 张」
 * - 前端压缩：canvas，长边 ≤1920、质量 0.8 → POST /api/upload（multipart 字段 file）
 * - 上传中：30% 遮罩 + 环形进度（Spinner）；失败：红色角标 + 点击重试
 * - 点击缩略图进入全屏预览（§7.12）：黑底 rgba(0,0,0,.92)、左右切换、删除（Text 红）
 */
"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { clsx } from "clsx";

import { Button, Spinner } from "@/components/ui";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, UPLOAD_URL_PREFIX } from "@/lib/constants";
import type { UploadResult } from "@/lib/types";
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, RetryIcon } from "./icons";

export type PhotoItem = {
  /** 本地预览 objectURL（上传期间展示） */
  localUrl: string;
  /** 服务端返回 URL（/uploads/...）；上传失败为 null */
  remoteUrl: string | null;
  uploading: boolean;
  error: string | null;
};

export type PhotoUploaderProps = {
  /** 已上传成功的 URL 列表（受控，仅含 /uploads/ 前缀） */
  value: string[];
  onChange: (urls: string[]) => void;
  /** 上传组件标注（无障碍），如「型号照片」「问题照片」 */
  label: string;
  /** 选填说明（Footnote） */
  hint?: string;
  className?: string;
};

/** 前端压缩：长边 ≤1920、质量 0.8，输出 image/jpeg（PRD §5.2.4 A5） */
async function compressImage(file: File): Promise<Blob> {
  // HEIC 等浏览器无法解码的格式，canvas 绘制会失败 → 原样上传，由服务端 sharp 处理
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const MAX_EDGE = 1920;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.8),
    );
    return blob && blob.size > 0 ? blob : file;
  } finally {
    bitmap.close();
  }
}

export function PhotoUploader({ value, onChange, label, hint, className }: PhotoUploaderProps) {
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = async (file: File, localUrl: string) => {
    setItems((prev) =>
      prev.map((it) => (it.localUrl === localUrl ? { ...it, uploading: true, error: null } : it)),
    );
    try {
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("单张图片不能超过 5MB");
      const blob = await compressImage(file);
      const form = new FormData();
      form.append("file", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as { code: number; message: string; data: UploadResult | null } | null;
      if (!json || json.code !== 0 || !json.data?.url) {
        throw new Error(json?.message || "图片上传失败，请重试");
      }
      const url = json.data.url;
      setItems((prev) =>
        prev.map((it) => (it.localUrl === localUrl ? { ...it, remoteUrl: url, uploading: false } : it)),
      );
      onChange([...value, url]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "图片上传失败，请重试";
      setItems((prev) =>
        prev.map((it) => (it.localUrl === localUrl ? { ...it, uploading: false, error: message } : it)),
      );
    }
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const remain = MAX_PHOTOS - value.length;
    if (remain <= 0) return;
    const picked = files.slice(0, remain);
    for (const file of picked) {
      const localUrl = URL.createObjectURL(file);
      setItems((prev) => [...prev, { localUrl, remoteUrl: null, uploading: false, error: null }]);
      void uploadOne(file, localUrl);
    }
  };

  const removeAt = (index: number) => {
    const item = items[index];
    if (!item) return;
    if (item.remoteUrl) onChange(value.filter((u) => u !== item.remoteUrl));
    URL.revokeObjectURL(item.localUrl);
    setItems((prev) => prev.filter((_, i) => i !== index));
    setPreviewIndex(null);
  };

  const reachedLimit = value.length >= MAX_PHOTOS;
  const uploadingCount = items.filter((i) => i.uploading).length;

  return (
    <div className={clsx("px-4 py-3", className)}>
      <div className="flex flex-wrap items-start gap-2.5">
        {items.map((item, i) => (
          <div key={item.localUrl} className="relative size-24 shrink-0">
            <button
              type="button"
              aria-label={`查看第 ${i + 1} 张照片`}
              onClick={() => setPreviewIndex(i)}
              className="block size-24 overflow-hidden rounded-thumb border border-separator bg-fill"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地预览必须 img 直出 */}
              <img src={item.localUrl} alt="" className="size-full object-cover" draggable={false} />
            </button>
            {/* 上传中：遮罩 + 环形进度（§6.6） */}
            {item.uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-thumb bg-[rgba(10,18,32,.3)]">
                <Spinner size={18} className="text-white" />
              </div>
            )}
            {/* 失败：红色角标 + 点击重试（§6.6） */}
            {item.error && !item.uploading && (
              <button
                type="button"
                aria-label={`上传失败：${item.error}，点击重试`}
                onClick={() => {
                  setItems((prev) =>
                    prev.map((it) => (it.localUrl === item.localUrl ? { ...it, error: null } : it)),
                  );
                  inputRef.current?.click();
                }}
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-thumb bg-danger py-1 text-caption text-white"
              >
                <RetryIcon className="size-3.5" />
                重试
              </button>
            )}
          </div>
        ))}

        {/* 入口瓦片：96×96，达 3 张上限后隐藏（§6.6） */}
        {!reachedLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label={`${label}，还可上传 ${MAX_PHOTOS - value.length} 张`}
            className="flex size-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-thumb border-[1.5px] border-dashed border-separator bg-fill text-label-2 transition-colors duration-(--dur-instant) hover:bg-separator/60 active:bg-separator/60"
          >
            <CameraIcon className="size-6" />
            <span className="text-caption">上传照片</span>
          </button>
        )}
      </div>

      <p className="mt-2 min-h-[1.125rem] text-footnote text-label-2">
        {uploadingCount > 0
          ? `正在上传 ${uploadingCount} 张…`
          : reachedLimit
            ? `最多 ${MAX_PHOTOS} 张，点击缩略图可查看或删除`
            : (hint ?? `选填，最多 ${MAX_PHOTOS} 张，单张 ≤5MB`)}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        onChange={onPick}
        className="hidden"
        aria-label={label}
      />

      {/* 全屏预览浮层（§7.12）：黑底 + 左右切换 + 删除 */}
      {previewIndex !== null && items[previewIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="照片预览"
          className="xx-fade-in fixed inset-0 z-(--z-modal) flex flex-col bg-[rgba(0,0,0,.92)]"
        >
          <div className="flex items-center justify-between px-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
            <button
              type="button"
              aria-label="关闭预览"
              onClick={() => setPreviewIndex(null)}
              className="flex size-11 items-center justify-center rounded-full text-white"
            >
              <CloseIcon className="size-6" />
            </button>
            <span className="text-footnote text-white/80 tabular-nums">
              {previewIndex + 1} / {items.length}
            </span>
            <span className="size-11" aria-hidden="true" />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- 预览必须 img 直出 */}
            <img
              src={items[previewIndex].localUrl}
              alt={`第 ${previewIndex + 1} 张照片`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex items-center justify-between px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="上一张"
                disabled={previewIndex === 0}
                onClick={() => setPreviewIndex((i) => (i === null ? null : Math.max(0, i - 1)))}
                className="flex size-11 items-center justify-center rounded-full text-white disabled:opacity-30"
              >
                <ChevronLeftIcon />
              </button>
              <button
                type="button"
                aria-label="下一张"
                disabled={previewIndex >= items.length - 1}
                onClick={() => setPreviewIndex((i) => (i === null ? null : Math.min(items.length - 1, i + 1)))}
                className="flex size-11 items-center justify-center rounded-full text-white disabled:opacity-30"
              >
                <ChevronRightIcon />
              </button>
            </div>
            <Button variant="text" onClick={() => removeAt(previewIndex)} className="text-danger">
              删除
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { UPLOAD_URL_PREFIX };
