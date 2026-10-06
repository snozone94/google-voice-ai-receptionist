const form = document.querySelector("#bookingForm");
const statusEl = document.querySelector("#bookingStatus");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(form).entries());
  const response = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (response.ok) {
    form.reset();
    statusEl.textContent = "Thanks. Your DDD booking request is in.";
  } else {
    statusEl.textContent = "Something went wrong. Please call DDD again.";
  }
});
