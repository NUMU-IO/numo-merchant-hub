import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../table";

describe("Table cards mode", () => {
  it("labels every cell with its column header for the phone card layout", () => {
    render(
      <Table cards>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Sara</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toHaveClass("tbl-cards");
    expect(screen.getByText("Sara")).toHaveAttribute("data-label", "Member");
    expect(screen.getByText("Active")).toHaveAttribute("data-label", "Status");
  });
});
