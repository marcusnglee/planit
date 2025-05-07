"use client";

import React, { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tables } from "@/lib/database.types";
import {
  FileText,
  Download,
  Calendar,
  CircleDollarSignIcon,
  Building,
  Coffee,
  Plus,
  ListIcon,
} from "lucide-react";
import Link from "next/link";
import { bucketName } from "@/lib/supabase";

type EventWithUrl = Tables<"event"> & {
  csvUrl?: string;
  jsonUrl?: string;
  pdfUrl?: string;
};

export default function EventList() {
  const [events, setEvents] = useState<EventWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);

        // Get the current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("User not authenticated");
        }

        // Fetch events for this user
        const { data, error } = await supabase
          .from("event")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Generate URLs for each event
        const eventsWithUrls = await Promise.all(
          (data || []).map(async (event) => {
            // Get URLs for the CSV, JSON, and PDF files
            const csvPath = `${user.id}/${event.event_name}/summary.csv`;
            const jsonPath = `${user.id}/${event.event_name}/data.json`;
            const pdfPath = `${user.id}/${event.event_name}/quote.pdf`;

            const {
              data: { publicUrl: csvUrl },
            } = supabase.storage.from(bucketName).getPublicUrl(csvPath);

            const {
              data: { publicUrl: jsonUrl },
            } = supabase.storage.from(bucketName).getPublicUrl(jsonPath);

            const {
              data: { publicUrl: pdfUrl },
            } = supabase.storage.from(bucketName).getPublicUrl(pdfPath);

            return {
              ...event,
              csvUrl,
              jsonUrl,
              pdfUrl,
            };
          })
        );

        setEvents(eventsWithUrls);
      } catch (err: any) {
        console.error("Error fetching events:", err);
        setError(err.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-planit border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Loading your events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <p className="font-medium">Error loading events</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 mb-6 max-w-md">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No events found</h3>
          <p className="text-gray-600 mb-6">
            You haven&apos;t uploaded any hotel quotes yet. Upload your first
            quote to get started!
          </p>
          <Button asChild className="bg-planit hover:bg-orange-400">
            <Link href="/dashboard/upload">
              <Plus className="mr-2 h-4 w-4" />
              Upload Your First Quote
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Helper function to render array of strings with proper formatting
  const renderFeatureArray = (items: string[]) => {
    if (!items || items.length === 0) return null;

    return (
      <ul className="list-disc pl-5 space-y-1">
        {items.map((item, index) => (
          <li key={index} className="text-sm">
            {item}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Your Events</h2>
        <Button asChild className="bg-planit hover:bg-orange-400">
          <Link href="/dashboard/upload">
            <Plus className="mr-2 h-4 w-4" />
            Upload New Quote
          </Link>
        </Button>
      </div>
      <div className="text-sm p-4 text-center ">
        ***note: JSON provides various total quote options in greater detail!
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <Card key={event.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-planit" />
                {event.event_name}
              </CardTitle>
              <CardDescription>
                {event.start_date && event.end_date
                  ? `${new Date(
                      event.start_date
                    ).toLocaleDateString()} - ${new Date(
                      event.end_date
                    ).toLocaleDateString()}`
                  : "Dates not specified"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-0">
              <div className="space-y-4">
                {event.currency && event.total_quote && (
                  <div className="flex items-center gap-2">
                    <CircleDollarSignIcon className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="text-sm">
                      <strong>{event.total_quote}</strong> {event.currency}
                    </span>
                  </div>
                )}

                {event.accommodation && (
                  <div className="flex gap-2">
                    <Building className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium mb-1">
                        Accommodation
                      </h4>
                      <p className="text-sm">{event.accommodation}</p>
                    </div>
                  </div>
                )}

                {event.meeting && (
                  <div className="flex gap-2">
                    <Coffee className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium mb-1">Meeting</h4>
                      <p className="text-sm">{event.meeting}</p>
                    </div>
                  </div>
                )}

                {event.food_beverage && (
                  <div className="flex gap-2">
                    <Coffee className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium mb-1">
                        Food & Beverage
                      </h4>
                      <p className="text-sm">{event.food_beverage}</p>
                    </div>
                  </div>
                )}

                {event.extras && event.extras.length > 0 && (
                  <div className="flex gap-2">
                    <ListIcon className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium mb-1">Extras</h4>
                      {renderFeatureArray(event.extras)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-5 flex justify-between">
              <Button variant="outline" size="sm" className="text-xs" asChild>
                <a
                  href={event.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  View PDF
                </a>
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <a href={event.csvUrl} download>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    CSV
                  </a>
                </Button>

                <Button variant="outline" size="sm" className="text-xs" asChild>
                  <a href={event.jsonUrl} download>
                    <Download className="h-3.5 w-3.5 mr-1" />
                    JSON
                  </a>
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
