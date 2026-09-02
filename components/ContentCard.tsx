"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { useScrollStore, type SectionId } from "@/store/useScrollStore";

/**
 * ContentCard — kartu cetakan foto (photo print) dengan animasi
 * "baru saja dipotret": saat section-nya aktif, kartu meluncur dari
 * TENGAH viewport (seolah foto baru diserahkan dari kamera/flash)
 * lalu menetap ke posisi istirahatnya (kiri/kanan + tilt masing-masing).
 *
 * Cara kerja:
 * - Posisi akhir tetap murni CSS (fixed side + -translate-y-1/2 +
 *   rotate statis di elemen kertas). GSAP hanya menganimasikan DELTA
 *   transform di wrapper: xPercent/yPercent untuk memindahkan kartu
 *   ke titik tengah viewport, scale 1.05, rotasi ekstra, opacity, dan
 *   drop shadow "dipegang tangan" → normal. Transform/opacity/box-shadow
 *   saja — tanpa layout thrash, tanpa membaca layout.
 * - `fromTo` membuat start state deterministik; tween baru selalu
 *   menggantikan tween sebelumnya (scroll cepat antar section aman).
 * - prefers-reduced-motion → tanpa luncur & tanpa suara; kartu cukup
 *   fade masuk lewat transisi CSS yang sudah ada.
 * - Deaktivasi tetap fade/slide keluar via transisi CSS pada aside;
 *   inline style sisa tween dibersihkan (clearProps) supaya exit
 *   dimulai dari pose istirahat.
 * - Frame cetak: kertas warm-white rata + bingkai foto putih dengan
 *   strip bawah lebih tebal (gaya cetakan klasik), rounded sangat kecil.
 * - Chrome per varian (`variant`): "print" = bingkai foto putih + strip
 *   bawah tebal (klasik, dipakai About); "sheet"/"strip"/"card" =
 *   kertas polos dengan hairline ring inset — satu keluarga cetakan.
 */

/** Jenis chrome/artefak: print (bingkai foto) | sheet | strip | card */
export type CardVariant = "print" | "sheet" | "strip" | "card";

/**
 * Judul display raksasa yang menumpang tepi atas kartu (vibe editorial).
 * Rotasi & offset di-hand-tune per kartu (deterministik — tanpa
 * Math.random agar SSR/hydration aman).
 */
export interface CardTitle {
  /** Kata display (mis. "ABOUT") */
  word: string;
  /** Rotasi label dalam derajat — bebas dari tilt kartu */
  rotate: number;
  /** Offset horizontal dari sudut kiri kartu (px) */
  x: number;
  /** Offset vertikal dalam % tinggi label — negatif = melayang di
      atas tepi kartu (mis. -55 → 55% di atas, 45% menumpang kartu) */
  y: number;
  /** Ukuran font (class Tailwind) — default clamp mobile→desktop */
  sizeClass?: string;
}

interface ContentCardProps {
  section: SectionId;
  side: "left" | "right";
  /** Kemiringan kartu dalam derajat (photo paper look) */
  tilt?: number;
  /** Chrome artefak — default "print" (bingkai foto klasik) */
  variant?: CardVariant;
  /** Kata display yang menumpang tepi atas kartu (opsional) */
  cardTitle?: CardTitle;
  children: ReactNode;
}

export default function ContentCard({
  section,
  side,
  tilt = 0,
  variant = "print",
  cardTitle,
  children,
}: ContentCardProps) {
  const active = useScrollStore((s) => s.activeSection === section);
  const animRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      // Deaktivasi — hentikan tween berjalan & bersihkan inline style
      // agar fade keluar CSS mulai dari pose istirahat.
      const el = animRef.current;
      if (el) {
        gsap.killTweensOf(el);
        gsap.set(el, { clearProps: "all" });
      }
      const shadow = shadowRef.current;
      if (shadow) {
        gsap.killTweensOf(shadow);
        gsap.set(shadow, { clearProps: "opacity" });
      }
      return;
    }

    // Aktivasi — tunggu satu frame agar class `visible` terpasang
    // dulu (opacity CSS 1) sebelum GSAP fromTo mengambil alih.
    const raf = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = animRef.current;
      if (!el) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return; // fade sederhana saja (CSS), tanpa luncur
      }

      // Kartu datang sedikit dari arah sisinya sendiri — terasa
      // seperti diserahkan tangan, bukan bergeser mekanis.
      const drift = side === "left" ? 1 : -1;

      // Bayangan "dipegang tangan": overlay statis di belakang kertas,
      // hanya OPACITY-nya yang di-tween (compositor-only). Tween
      // boxShadow langsung = repaint kartu per frame — mahal tepat saat
      // flash full-viewport + snap-scroll ikut berjalan. Opacity 1→0 di
      // atas bayangan istirahat class ≈ interpolasi lama 0.55 → 0.28.
      const shadow = shadowRef.current;

      gsap
        .timeline({ defaults: { duration: 0.85, ease: "power3.out" } })
        .fromTo(
          el,
          {
            xPercent: -50,
            yPercent: -50, // pas tengah viewport (hotspot flash)
            x: drift * 18,
            scale: 1.05, // kecil — kartu setinggi hampir viewport
            rotation: tilt * 2.6 + drift * 4, // lebih miring dari final
            autoAlpha: 0.9,
          },
          {
            xPercent: 0,
            yPercent: 0,
            x: 0,
            scale: 1,
            rotation: 0,
            autoAlpha: 1,
          },
        )
        // Bayangan besar memudar paralel (position 0) — murni opacity.
        .fromTo(
          shadow ?? [],
          { opacity: 1 },
          { opacity: 0 },
          0,
        );
    });
    rafRef.current = raf;

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, side, tilt]);

  const positionClass =
    side === "left" ? "left-6 sm:left-12" : "right-6 sm:right-12";
  const hiddenClass =
    side === "left"
      ? "-translate-x-8 opacity-0 invisible pointer-events-none"
      : "translate-x-8 opacity-0 invisible pointer-events-none";
  const shownClass = "translate-x-0 opacity-100 visible pointer-events-auto";

  return (
    <aside
      aria-hidden={!active}
      className={`fixed top-1/2 z-20 w-[380px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-3rem)] max-h-[calc(100dvh-3rem)] -translate-y-1/2 transition-all duration-500 ease-out ${positionClass} ${
        active ? shownClass : hiddenClass
      }`}
    >
      {/* Wrapper animasi — transform/opacity/shadow GSAP di sini saja.
          Bayangan class = nilai istirahat (senada nilai akhir tween).
          `relative` = anchor untuk judul display yang menumpang tepi. */}
      <div
        ref={animRef}
        className="relative will-change-transform shadow-[0_12px_26px_-6px_rgb(15_14_12_/_28%)]"
      >
        {/* Overlay bayangan "dipegang tangan" — statis (TIDAK pernah
            di-tween nilai boxShadow-nya), tersembunyi di belakang kertas.
            Hanya opacity-nya yang dianimasikan timeline launch → murni
            compositing; memudar di atas bayangan istirahat class wrapper
            memberi hasil visual yang sama dengan interpolasi lama. */}
        <div
          ref={shadowRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-[3px]"
          style={{
            boxShadow: "0 30px 70px -12px rgba(15, 14, 12, 0.55)",
          }}
        />
        {/* Kertas — miring sesuai tilt; chrome mengikuti varian artefak.
            Guardrail vertikal: max-h 100dvh−3rem + overflow-hidden di
            KERTAS (bukan di wrapper/aside) — label yang melayang di atas
            kartu ada di luar kertas sehingga tidak pernah terpotong; kalau
            konten melampaui, fallback = crop di dalam kertas (bukan
            scrollbar). Konten didesain agar fallback tidak pernah aktif
            pada tinggi viewport terverifikasi (≥640px).
            pt-8 area konten memberi ruang bagi separuh-bawah judul yang
            menumpang tepi atas kartu. */}
        <div
          className={`max-h-[calc(100vh-3rem)] max-h-[calc(100dvh-3rem)] overflow-hidden rounded-[3px] bg-[#fffefa] text-left ${
            variant === "print" ? "p-4 pb-0" : variant === "card" ? "p-5" : "p-4"
          }`}
          style={{ transform: `rotate(${tilt}deg)` }}
        >
          {variant === "print" ? (
            /* Bingkai foto putih — margin rata, strip bawah lebih tebal
                (pb-14) ala cetakan klasik; hairline ring memisahkan
                bingkai dari kertas */
            <div className="rounded-[2px] bg-white p-3 pb-14 pt-8 ring-1 ring-[#20201f]/10">
              {children}
            </div>
          ) : (
            /* Artefak kertas lain — hairline ring inset (keluarga
                cetakan yang sama), konten menyusun strukturnya sendiri */
            <div
              className={`rounded-[2px] ring-1 ring-[#20201f]/10 ${
                variant === "card" ? "p-5 pt-8 pb-10" : "p-4 pt-8 pb-10"
              }`}
            >
              {children}
            </div>
          )}
        </div>

        {/* Judul display raksasa — menumpang tepi atas kartu, rotasi
            sendiri (bebas dari tilt kertas). aria-hidden: murni dekorasi
            (h3 kartu tetap satu-satunya heading); pointer-events-none
            agar tautan di dalam kartu tetap klikabel. Ikut terbang
            bersama kartu karena berada di dalam wrapper GSAP. */}
        {cardTitle && (
          <span
            aria-hidden
            className={`pointer-events-none absolute left-0 top-0 z-10 select-none whitespace-nowrap font-display uppercase leading-none tracking-tight text-accent ${
              cardTitle.sizeClass ?? "text-[clamp(2.6rem,11vw,4rem)]"
            }`}
            style={{
              transform: `translate(${cardTitle.x}px, ${cardTitle.y}%) rotate(${cardTitle.rotate}deg)`,
            }}
          >
            {cardTitle.word}
          </span>
        )}
      </div>
    </aside>
  );
}
