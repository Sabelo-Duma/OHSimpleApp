import React from "react";

export default function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full flex flex-col flex-grow">
      <h2 className="text-xl font-bold text-center mb-6 text-black-700">
        {title}
      </h2>
      <div className="w-full flex flex-col flex-grow">{children}</div>
    </section>
  );
}