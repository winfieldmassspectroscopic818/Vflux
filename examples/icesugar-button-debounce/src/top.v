// Button debounce example for iCESugar.

module top (
  input  wire clk,
  input  wire btn1,
  input  wire btn2,
  output reg  led1 = 1'b0,
  output wire led2,
  output wire led3
);
  wire btn1_clean;
  wire btn1_press;
  reg [23:0] heartbeat = 24'd0;

  debounce #(.WIDTH(18)) debounce_btn1 (
    .clk(clk),
    .noisy(btn1),
    .clean(btn1_clean),
    .rose(btn1_press)
  );

  always @(posedge clk) begin
    heartbeat <= heartbeat + 24'd1;
    if (btn1_press) led1 <= ~led1;
  end

  assign led2 = btn1_clean;
  assign led3 = heartbeat[23] ^ btn2;
endmodule
