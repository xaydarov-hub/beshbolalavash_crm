import React from "react";
// Retain desktop columns; expose the same labels on stacked mobile rows.
export default function ResponsiveTable({ children, ...props }) {
  const rows = React.Children.toArray(children);
  const header = rows.find(row => React.isValidElement(row) && row.props.className?.includes("thead"));
  const labels = header ? React.Children.toArray(header.props.children).map(cell => cell.props?.children || "") : [];
  return <div {...props} className={`table-wrap responsive-table ${props.className || ""}`}>
    {rows.map(row => {
      if (!React.isValidElement(row) || !row.props.className?.split(" ").includes("trow") || row === header) return row;
      return React.cloneElement(row, {}, React.Children.toArray(row.props.children).map((cell, i) => <div className="responsive-cell" key={i}>{labels[i] && <span className="mobile-cell-label">{labels[i]}</span>}{cell}</div>));
    })}
  </div>;
}
