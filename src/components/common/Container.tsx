import React from "react";

type ContainerProps = {
  children: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>; // make optional
};

export default function Container({ children, containerRef }: ContainerProps) {
  return (
    <div
      ref={containerRef ?? undefined} // only attach if provided
      className="w-full max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col"
    >
      {children}
    </div>
  );
}

