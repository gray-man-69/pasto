"use client";

import Link from "next/link";
import ExercisePicker from "@/components/ExercisePicker";

export default function ExercisesPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Exercise library</h1>
        <Link href="/training" className="btn btn-ghost btn-sm">
          ← Training
        </Link>
      </div>
      <ExercisePicker />
    </div>
  );
}
