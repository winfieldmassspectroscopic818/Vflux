// Simple button debouncer with two-stage synchronization.

module debounce #(
  parameter WIDTH = 18
) (
  input  wire clk,
  input  wire noisy,
  output reg  clean = 1'b0,
  output wire rose
);
  reg sync_0 = 1'b0;
  reg sync_1 = 1'b0;
  reg last_clean = 1'b0;
  reg [WIDTH-1:0] counter = {WIDTH{1'b0}};

  assign rose = clean & ~last_clean;

  always @(posedge clk) begin
    sync_0 <= noisy;
    sync_1 <= sync_0;
    last_clean <= clean;

    if (sync_1 == clean) begin
      counter <= {WIDTH{1'b0}};
    end else begin
      counter <= counter + {{(WIDTH-1){1'b0}}, 1'b1};
      if (&counter) begin
        clean <= sync_1;
        counter <= {WIDTH{1'b0}};
      end
    end
  end
endmodule
