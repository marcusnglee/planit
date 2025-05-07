// lots of anys... oops
export async function insertEventIntoDatabase(
  supabase: any,
  user: any,
  eventName: string,
  quoteJson: any
) {
  if (
    !quoteJson ||
    !quoteJson.total_quote_options ||
    quoteJson.total_quote_options.length === 0
  ) {
    console.error("No valid quote data available to insert into database");
    return { error: "No valid quote data available" };
  }
  const firstOption = quoteJson.total_quote_options[0];

  // prepare the database record
  const eventRecord = {
    event_name: eventName,
    user_id: user.id,
    currency: quoteJson.currency || null,
    start_date: quoteJson.start_date || null,
    end_date: quoteJson.end_date || null,
    total_quote: firstOption.total_quote
      ? firstOption.total_quote.toString()
      : null,
    accommodation: Array.isArray(firstOption.features?.accommodation)
      ? firstOption.features.accommodation.join(", ")
      : firstOption.features?.accommodation || null,
    meeting: Array.isArray(firstOption.features?.meeting)
      ? firstOption.features.meeting.join(", ")
      : firstOption.features?.meeting || null,
    food_beverage: Array.isArray(firstOption.features?.food_beverage)
      ? firstOption.features.food_beverage.join(", ")
      : firstOption.features?.food_beverage || null,
    extras: Array.isArray(firstOption.features?.extras)
      ? firstOption.features.extras
      : firstOption.features?.extras
      ? [firstOption.features.extras]
      : [],
    json_url: `${user.id}/${eventName}/data.json`,
  };

  console.log("Inserting event into database:", eventRecord);

  // Insert the record into the database
  const { data, error } = await supabase
    .from("event")
    .insert(eventRecord)
    .select();

  if (error) {
    console.error("Error inserting event into database:", error);
    return { error };
  }

  console.log("Event inserted successfully:", data);
  return { data };
}
