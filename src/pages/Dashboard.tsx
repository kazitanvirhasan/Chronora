import React from 'react';
import Timer from './Timer';
import Insights from './Insights';

export default function Dashboard() {
  return (
    <div className="space-y-8 pt-4 md:pt-0">
      <section>
        <Timer />
      </section>
      <section>
        <Insights />
      </section>
    </div>
  );
}
