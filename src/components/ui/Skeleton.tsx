// src/components/ui/Skeleton.tsx

import React from "react";

type SkeletonProps = {
  className?: string;
  height?: string | number;
  width?: string | number;
};

export default function Skeleton({
  className = "",
  height,
  width,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    height: height
      ? typeof height === "number"
        ? `${height}px`
        : height
      : undefined,
    width: width
      ? typeof width === "number"
        ? `${width}px`
        : width
      : undefined,
  };

  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-md ${className}`}
      style={style}
    />
  );
}
