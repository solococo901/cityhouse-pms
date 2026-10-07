"use client";



import {

  PointerEvent as ReactPointerEvent,

  useMemo,

  useState,

} from "react";



import {

  DndContext,

  DragEndEvent,

  DragStartEvent,

  PointerSensor,

  useDraggable,

  useDroppable,

  useSensor,

  useSensors,

} from "@dnd-kit/core";



import BookingDrawer, {

  CalendarBooking,

} from "@/components/staff/booking-drawer";



import BookingChangeModal, {

  BookingChangePreview,

} from "@/components/staff/booking-change-modal";



/* ======================================================

   CONFIG

====================================================== */



const CELL_WIDTH = 76;

const ROOM_COLUMN_WIDTH = 135;



const DEFAULT_CHECK_IN_HOUR = 12;

const DEFAULT_CHECK_OUT_HOUR = 14;



/* ======================================================

   TYPES

====================================================== */



type Room = {

  id: string;

  room_number: string;

  room_type_id: string;

  roomTypeName: string;

};



type InventoryRow = {

  room_type_id: string;

  stay_date: string;

  total_rooms: number;

  available_rooms: number;

};



type RateRow = {

  room_type_id: string;

  rate_plan_id: string;

  stay_date: string;

  price: number | string;

};



type Props = {

  dates: string[];

  rooms: Room[];

  bookings: CalendarBooking[];



  inventory?: InventoryRow[];

  rates?: RateRow[];

};



type PreviewState = {

  preview: BookingChangePreview;

  targetRoom: Room;

} | null;



type ResizeSide = "left" | "right";



type RoomTypeGroup = {

  id: string;

  name: string;

  rooms: Room[];

};



/* ======================================================

   DATE

====================================================== */



function dateDiff(

  start: string,

  end: string

) {

  const startDate = new Date(

    `${start}T00:00:00Z`

  );



  const endDate = new Date(

    `${end}T00:00:00Z`

  );



  return Math.round(

    (endDate.getTime() -

      startDate.getTime()) /

      86400000

  );

}



function addDays(

  date: string,

  amount: number

) {

  const value = new Date(

    `${date}T00:00:00Z`

  );



  value.setUTCDate(

    value.getUTCDate() + amount

  );



  return value

    .toISOString()

    .slice(0, 10);

}



function getVietnamToday() {

  const parts =

    new Intl.DateTimeFormat(

      "en-US",

      {

        timeZone:

          "Asia/Ho_Chi_Minh",



        year: "numeric",

        month: "2-digit",

        day: "2-digit",

      }

    ).formatToParts(new Date());



  const year =

    parts.find(

      (item) =>

        item.type === "year"

    )?.value ?? "";



  const month =

    parts.find(

      (item) =>

        item.type === "month"

    )?.value ?? "";



  const day =

    parts.find(

      (item) =>

        item.type === "day"

    )?.value ?? "";



  return `${year}-${month}-${day}`;

}



function formatWeekday(

  date: string

) {

  return new Intl.DateTimeFormat(

    "en-US",

    {

      weekday: "short",

    }

  )

    .format(

      new Date(

        `${date}T00:00:00Z`

      )

    )

    .toUpperCase();

}



function formatDay(

  date: string

) {

  return new Date(

    `${date}T00:00:00Z`

  ).getUTCDate();

}



/* ======================================================

   MONEY

====================================================== */



function compactMoney(

  value: number

) {

  if (value <= 0) {

    return "—";

  }



  if (

    value >= 1000000

  ) {

    const million =

      value / 1000000;



    return `${million

      .toFixed(

        million % 1 === 0

          ? 0

          : 2

      )

      .replace(

        /\.?0+$/,

        ""

      )}m`;

  }



  return `${Math.round(

    value / 1000

  )}k`;

}



/* ======================================================

   BOOKING POSITION

====================================================== */



function getBookingPosition({

  calendarStartDate,

  checkIn,

  checkOut,

  totalDays,

}: {

  calendarStartDate: string;

  checkIn: string;

  checkOut: string;

  totalDays: number;

}) {

  const checkInDay =

    dateDiff(

      calendarStartDate,

      checkIn

    );



  const checkOutDay =

    dateDiff(

      calendarStartDate,

      checkOut

    );



  const startFraction =

    DEFAULT_CHECK_IN_HOUR /

    24;



  const endFraction =

    DEFAULT_CHECK_OUT_HOUR /

    24;



  const rawStart =

    checkInDay +

    startFraction;



  const rawEnd =

    checkOutDay +

    endFraction;



  if (

    rawEnd <= 0 ||

    rawStart >= totalDays

  ) {

    return null;

  }



  const visibleStart =

    Math.max(

      0,

      rawStart

    );



  const visibleEnd =

    Math.min(

      totalDays,

      rawEnd

    );



  return {

    left:

      visibleStart *

      CELL_WIDTH,



    width:

      Math.max(

        42,

        (visibleEnd -

          visibleStart) *

          CELL_WIDTH

      ),

  };

}



/* ======================================================

   MAIN

====================================================== */



export default function ReservationCalendar({

  dates,

  rooms,

  bookings,

  inventory = [],

  rates = [],

}: Props) {

  const sensors =

    useSensors(

      useSensor(

        PointerSensor,

        {

          activationConstraint: {

            distance: 5,

          },

        }

      )

    );



  const [

    loading,

    setLoading,

  ] =

    useState(false);



  const [

    errorMessage,

    setErrorMessage,

  ] =

    useState("");



  const [

    selectedBooking,

    setSelectedBooking,

  ] =

    useState<CalendarBooking | null>(

      null

    );



  const [

    changePreview,

    setChangePreview,

  ] =

    useState<PreviewState>(

      null

    );



  const [

    activeBookingId,

    setActiveBookingId,

  ] =

    useState<string | null>(

      null

    );



  const [

    resizingBookingId,

    setResizingBookingId,

  ] =

    useState<string | null>(

      null

    );



  const [

    collapsedRoomTypes,

    setCollapsedRoomTypes,

  ] =

    useState<Set<string>>(

      new Set()

    );



  /* ======================================================

     GROUP ROOM TYPES

  ====================================================== */



  const roomTypeGroups =

    useMemo<

      RoomTypeGroup[]

    >(() => {

      const map =

        new Map<

          string,

          RoomTypeGroup

        >();



      for (

        const room of rooms

      ) {

        const existing =

          map.get(

            room.room_type_id

          );



        if (existing) {

          existing.rooms.push(

            room

          );

        } else {

          map.set(

            room.room_type_id,

            {

              id:

                room.room_type_id,



              name:

                room.roomTypeName,



              rooms: [

                room,

              ],

            }

          );

        }

      }



      return Array.from(

        map.values()

      );

    }, [rooms]);



  /* ======================================================

     INVENTORY

  ====================================================== */



  function getAvailability(

    roomTypeId: string,

    date: string,

    roomCount: number

  ) {

    const row =

      inventory.find(

        (item) =>

          item.room_type_id ===

            roomTypeId &&

          item.stay_date ===

            date

      );



    if (row) {

      return row.available_rooms;

    }



    /*

     * Fallback nếu chưa có inventory row:

     * tính từ booking thực tế.

     */



    const occupied =

      new Set(

        bookings

          .filter(

            (booking) =>

              booking.room_id &&

              booking.status !==

                "cancelled" &&

              booking.status !==

                "no_show" &&

              booking.check_in <=

                date &&

              booking.check_out >

                date

          )

          .map(

            (booking) =>

              booking.room_id

          )

      ).size;



    return Math.max(

      0,

      roomCount -

        occupied

    );

  }



  /* ======================================================

     RATE

  ====================================================== */



  function getRate(

    roomTypeId: string,

    date: string

  ) {

    const rows =

      rates.filter(

        (item) =>

          item.room_type_id ===

            roomTypeId &&

          item.stay_date ===

            date

      );



    if (

      rows.length === 0

    ) {

      return 0;

    }



    /*

     * Nếu có nhiều Rate Plan:

     * hiển thị giá thấp nhất.

     */



    return Math.min(

      ...rows.map(

        (item) =>

          Number(

            item.price

          )

      )

    );

  }



  /* ======================================================

     OCCUPANCY

  ====================================================== */



  function getOccupancy(

    date: string

  ) {

    if (

      rooms.length === 0

    ) {

      return {

        occupied: 0,

        percentage: 0,

      };

    }



    const occupiedRooms =

      new Set(

        bookings

          .filter(

            (booking) =>

              booking.room_id &&

              booking.status !==

                "cancelled" &&

              booking.status !==

                "no_show" &&

              booking.check_in <=

                date &&

              booking.check_out >

                date

          )

          .map(

            (booking) =>

              booking.room_id

          )

      );



    const occupied =

      occupiedRooms.size;



    const percentage =

      Math.round(

        (occupied /

          rooms.length) *

          100

      );



    return {

      occupied,

      percentage,

    };

  }



  /* ======================================================

     PREVIEW CHANGE

  ====================================================== */



  async function previewBookingChange({

    booking,

    targetRoom,

    newCheckIn,

    newCheckOut,

  }: {

    booking:

      CalendarBooking;



    targetRoom:

      Room;



    newCheckIn:

      string;



    newCheckOut:

      string;

  }) {

    setLoading(true);

    setErrorMessage("");



    try {

      const response =

        await fetch(

          "/api/staff/bookings/preview-change",

          {

            method:

              "POST",



            headers: {

              "Content-Type":

                "application/json",

            },



            body:

              JSON.stringify({

                bookingRoomId:

                  booking.id,



                targetRoomId:

                  targetRoom.id,



                newCheckIn,



                newCheckOut,

              }),

          }

        );



      const result =

        await response.json();



      if (

        !response.ok

      ) {

        setErrorMessage(

          result.error ||

            "Không thể kiểm tra booking."

        );



        return;

      }



      if (

        !result.preview

      ) {

        setErrorMessage(

          "Không nhận được dữ liệu preview."

        );



        return;

      }



      setChangePreview({

        preview:

          result.preview,



        targetRoom,

      });

    } catch (error) {

      console.error(

        error

      );



      setErrorMessage(

        "Có lỗi xảy ra khi kiểm tra booking."

      );

    } finally {

      setLoading(false);

    }

  }



  /* ======================================================

     DRAG

  ====================================================== */



  function handleDragStart(

    event: DragStartEvent

  ) {

    if (

      resizingBookingId

    ) {

      return;

    }



    setActiveBookingId(

      String(

        event.active.id

      )

    );



    setSelectedBooking(

      null

    );

  }



  async function handleDragEnd(

    event: DragEndEvent

  ) {

    setActiveBookingId(

      null

    );



    if (

      resizingBookingId

    ) {

      return;

    }



    const {

      active,

      over,

      delta,

    } = event;



    if (!over) {

      return;

    }



    const booking =

      bookings.find(

        (item) =>

          item.id ===

          String(

            active.id

          )

      );



    if (!booking) {

      return;

    }



    const targetRoom =

      rooms.find(

        (room) =>

          room.id ===

          String(

            over.id

          )

      );



    if (!targetRoom) {

      return;

    }



    const dayShift =

      Math.round(

        delta.x /

          CELL_WIDTH

      );



    const newCheckIn =

      addDays(

        booking.check_in,

        dayShift

      );



    const newCheckOut =

      addDays(

        booking.check_out,

        dayShift

      );



    if (

      booking.room_id ===

        targetRoom.id &&

      dayShift === 0

    ) {

      return;

    }



    await previewBookingChange({

      booking,

      targetRoom,

      newCheckIn,

      newCheckOut,

    });

  }



  /* ======================================================

     RESIZE

  ====================================================== */



  async function handleResize({

    booking,

    side,

    dayDelta,

  }: {

    booking:

      CalendarBooking;



    side:

      ResizeSide;



    dayDelta:

      number;

  }) {

    if (

      dayDelta === 0

    ) {

      return;

    }



    if (

      !booking.room_id

    ) {

      return;

    }



    const targetRoom =

      rooms.find(

        (room) =>

          room.id ===

          booking.room_id

      );



    if (!targetRoom) {

      return;

    }



    let newCheckIn =

      booking.check_in;



    let newCheckOut =

      booking.check_out;



    if (

      side === "left"

    ) {

      newCheckIn =

        addDays(

          newCheckIn,

          dayDelta

        );

    } else {

      newCheckOut =

        addDays(

          newCheckOut,

          dayDelta

        );

    }



    if (

      newCheckOut <=

      newCheckIn

    ) {

      setErrorMessage(

        "Booking phải có ít nhất 1 đêm."

      );



      return;

    }



    await previewBookingChange({

      booking,

      targetRoom,

      newCheckIn,

      newCheckOut,

    });

  }



  /* ======================================================

     COLLAPSE

  ====================================================== */



  function toggleRoomType(

    roomTypeId: string

  ) {

    setCollapsedRoomTypes(

      (current) => {

        const next =

          new Set(

            current

          );



        if (

          next.has(

            roomTypeId

          )

        ) {

          next.delete(

            roomTypeId

          );

        } else {

          next.add(

            roomTypeId

          );

        }



        return next;

      }

    );

  }



  const today =

    getVietnamToday();



  /* ======================================================

     UI

  ====================================================== */



  return (

    <>

      <DndContext
        id="reservation-calendar-dnd"

        sensors={

          sensors

        }

        onDragStart={

          handleDragStart

        }

        onDragEnd={

          handleDragEnd

        }

        onDragCancel={() =>

          setActiveBookingId(

            null

          )

        }

      >

        {/* STATUS */}



        {errorMessage && (

          <div className="mb-3 flex items-center justify-between border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">

            {errorMessage}



            <button

              type="button"

              onClick={() =>

                setErrorMessage(

                  ""

                )

              }

              className="font-bold"

            >

              ×

            </button>

          </div>

        )}



        {loading && (

          <div className="mb-3 border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-700">

            Checking availability and price...

          </div>

        )}



        {/* CALENDAR */}



        <div className="overflow-auto border border-slate-200 bg-white">

          <div className="min-w-max">

            {/* =============================================

                DAY HEADER

            ============================================== */}



            <div className="flex border-b border-slate-300 bg-white">

              <div

                style={{

                  width:

                    ROOM_COLUMN_WIDTH,

                }}

                className="sticky left-0 z-40 flex shrink-0 items-end border-r border-slate-300 bg-white px-2 py-2"

              >

                <span className="text-[11px] font-semibold text-slate-600">

                  All Room Types

                </span>

              </div>



              {dates.map(

                (date) => {

                  const occupancy =

                    getOccupancy(

                      date

                    );



                  const isToday =

                    date ===

                    today;



                  return (

                    <div

                      key={

                        date

                      }

                      style={{

                        width:

                          CELL_WIDTH,

                      }}

                      className={`relative shrink-0 border-r border-slate-200 py-1.5 text-center ${

                        isToday

                          ? "bg-cyan-50"

                          : "bg-white"

                      }`}

                    >

                      {/* OCCUPIED COUNT */}



                      <div className="mx-auto mb-1 flex h-4 min-w-5 items-center justify-center rounded-full bg-slate-300 px-1 text-[9px] font-bold text-white">

                        {

                          occupancy.occupied

                        }

                      </div>



                      {/* DATE */}



                      <div

                        className={`text-[10px] font-bold ${

                          isToday

                            ? "text-slate-900"

                            : "text-slate-500"

                        }`}

                      >

                        {formatWeekday(

                          date

                        )}{" "}

                        {formatDay(

                          date

                        )}

                      </div>



                      {/* OCCUPANCY */}



                      <div className="text-[9px] font-semibold text-slate-500">

                        {

                          occupancy.percentage

                        }

                        %

                      </div>

                    </div>

                  );

                }

              )}

            </div>



            {/* =============================================

                ROOM TYPES

            ============================================== */}



            {roomTypeGroups.map(

              (

                group

              ) => {

                const collapsed =

                  collapsedRoomTypes.has(

                    group.id

                  );



                return (

                  <div

                    key={

                      group.id

                    }

                  >

                    {/* =====================================

                        ROOM TYPE SUMMARY

                    ====================================== */}



                    <div className="flex border-b border-slate-300 bg-slate-50">

                      <button

                        type="button"

                        onClick={() =>

                          toggleRoomType(

                            group.id

                          )

                        }

                        style={{

                          width:

                            ROOM_COLUMN_WIDTH,

                        }}

                        className="sticky left-0 z-30 flex shrink-0 items-center gap-1 border-r border-slate-300 bg-slate-50 px-1.5 py-1 text-left"

                      >

                        <span className="text-[9px] text-slate-600">

                          {collapsed

                            ? "▸"

                            : "▾"}

                        </span>



                        <span className="truncate text-[10px] font-bold text-slate-800">

                          {

                            group.name

                          }

                        </span>

                      </button>



                      {dates.map(

                        (

                          date

                        ) => {

                          const available =

                            getAvailability(

                              group.id,

                              date,

                              group

                                .rooms

                                .length

                            );



                          const rate =

                            getRate(

                              group.id,

                              date

                            );



                          return (

                            <div

                              key={

                                date

                              }

                              style={{

                                width:

                                  CELL_WIDTH,

                              }}

                              className="shrink-0 border-r border-slate-200 bg-slate-50 px-1 py-1 text-center"

                            >

                              <div className="text-[10px] font-medium text-slate-700">

                                {

                                  available

                                }

                              </div>



                              <div className="truncate text-[9px] font-semibold text-slate-500 underline">

                                {compactMoney(

                                  rate

                                )}

                              </div>

                            </div>

                          );

                        }

                      )}

                    </div>



                    {/* =====================================

                        PHYSICAL ROOMS

                    ====================================== */}



                    {!collapsed &&

                      group.rooms.map(

                        (

                          room

                        ) => (

                          <RoomRow

                            key={

                              room.id

                            }



                            room={

                              room

                            }



                            dates={

                              dates

                            }



                            bookings={

                              bookings.filter(

                                (

                                  booking

                                ) =>

                                  booking.room_id ===

                                  room.id

                              )

                            }



                            activeBookingId={

                              activeBookingId

                            }



                            resizingBookingId={

                              resizingBookingId

                            }



                            onOpenBooking={(

                              booking

                            ) =>

                              setSelectedBooking(

                                booking

                              )

                            }



                            onResize={

                              handleResize

                            }



                            onResizeStart={(

                              id

                            ) => {

                              setResizingBookingId(

                                id

                              );



                              setSelectedBooking(

                                null

                              );

                            }}



                            onResizeEnd={() =>

                              setResizingBookingId(

                                null

                              )

                            }

                          />

                        )

                      )}

                  </div>

                );

              }

            )}

          </div>

        </div>



        {/* DRAWER */}



        <BookingDrawer

          booking={

            selectedBooking

          }

          onClose={() =>

            setSelectedBooking(

              null

            )

          }

        />

      </DndContext>



      {/* CHANGE MODAL */}



      <BookingChangeModal

        preview={

          changePreview

            ?.preview ??

          null

        }



        targetRoomNumber={

          changePreview

            ?.targetRoom

            .room_number ??

          ""

        }



        targetRoomTypeName={

          changePreview

            ?.targetRoom

            .roomTypeName ??

          ""

        }



        onClose={() =>

          setChangePreview(

            null

          )

        }

      />

    </>

  );

}



/* ======================================================

   ROOM ROW

====================================================== */



function RoomRow({

  room,

  dates,

  bookings,



  activeBookingId,

  resizingBookingId,



  onOpenBooking,



  onResize,

  onResizeStart,

  onResizeEnd,

}: {

  room: Room;



  dates: string[];



  bookings:

    CalendarBooking[];



  activeBookingId:

    string | null;



  resizingBookingId:

    string | null;



  onOpenBooking: (

    booking:

      CalendarBooking

  ) => void;



  onResize: (

    args: {

      booking:

        CalendarBooking;



      side:

        ResizeSide;



      dayDelta:

        number;

    }

  ) => Promise<void>;



  onResizeStart: (

    bookingId:

      string

  ) => void;



  onResizeEnd:

    () => void;

}) {

  const {

    setNodeRef,

    isOver,

  } =

    useDroppable({

      id:

        room.id,

    });



  const startDate =

    dates[0];



  return (

    <div

      ref={

        setNodeRef

      }

      className={`flex h-[38px] border-b border-slate-200 ${

        isOver

          ? "bg-blue-50"

          : "bg-white"

      }`}

    >

      {/* ROOM NUMBER */}



      <div

        style={{

          width:

            ROOM_COLUMN_WIDTH,

        }}

        className="sticky left-0 z-20 flex shrink-0 items-center border-r border-slate-300 bg-white px-1.5"

      >

        <span className="text-[10px] font-medium text-slate-600">

          {

            room.room_number

          }

        </span>



        <span className="ml-auto text-[10px] font-bold text-red-400">

          *

        </span>

      </div>



      {/* TIMELINE */}



      <div

        className="relative flex h-full"

        style={{

          width:

            dates.length *

            CELL_WIDTH,

        }}

      >

        {/* CELLS */}



        {dates.map(

          (

            date

          ) => (

            <div

              key={

                date

              }

              style={{

                width:

                  CELL_WIDTH,

              }}

              className="relative h-full shrink-0 border-r border-slate-200"

            >

              {/* 12:00 */}



              <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 border-l border-dashed border-slate-100" />

            </div>

          )

        )}



        {/* BOOKINGS */}



        {bookings.map(

          (

            booking

          ) => {

            const position =

              getBookingPosition({

                calendarStartDate:

                  startDate,



                checkIn:

                  booking.check_in,



                checkOut:

                  booking.check_out,



                totalDays:

                  dates.length,

              });



            if (

              !position

            ) {

              return null;

            }



            return (

              <BookingBar

                key={

                  booking.id

                }



                booking={

                  booking

                }



                left={

                  position.left

                }



                width={

                  position.width

                }



                activeDragging={

                  activeBookingId ===

                  booking.id

                }



                activeResizing={

                  resizingBookingId ===

                  booking.id

                }



                onOpen={() =>

                  onOpenBooking(

                    booking

                  )

                }



                onResize={

                  onResize

                }



                onResizeStart={

                  onResizeStart

                }



                onResizeEnd={

                  onResizeEnd

                }

              />

            );

          }

        )}

      </div>

    </div>

  );

}



/* ======================================================

   BOOKING BAR

====================================================== */



function BookingBar({

  booking,

  left,

  width,



  activeDragging,

  activeResizing,



  onOpen,



  onResize,

  onResizeStart,

  onResizeEnd,

}: {

  booking:

    CalendarBooking;



  left:

    number;



  width:

    number;



  activeDragging:

    boolean;



  activeResizing:

    boolean;



  onOpen:

    () => void;



  onResize: (

    args: {

      booking:

        CalendarBooking;



      side:

        ResizeSide;



      dayDelta:

        number;

    }

  ) => Promise<void>;



  onResizeStart: (

    bookingId:

      string

  ) => void;



  onResizeEnd:

    () => void;

}) {

  const {

    attributes,

    listeners,

    setNodeRef,

    transform,

    isDragging,

  } =

    useDraggable({

      id:

        booking.id,



      disabled:

        activeResizing,

    });



  const transformStyle =

    transform

      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`

      : undefined;



  function bookingStyle() {

    const source =

      booking.source

        ?.toLowerCase() ??

      "";



    if (

      booking.status ===

      "cancelled"

    ) {

      return "bg-red-400 text-white";

    }



    if (

      booking.status ===

      "checked_in"

    ) {

      return "bg-emerald-500 text-white";

    }



    if (

      booking.status ===

      "checked_out"

    ) {

      return "bg-slate-400 text-white";

    }



    if (

      booking.status ===

      "pending"

    ) {

      return "bg-slate-500 text-white";

    }



    if (

      source ===

      "direct"

    ) {

      return "bg-emerald-500 text-white";

    }



    if (

      source.includes(

        "booking"

      ) ||

      source.includes(

        "agoda"

      ) ||

      source.includes(

        "expedia"

      ) ||

      source.includes(

        "airbnb"

      ) ||

      source.includes(

        "channex"

      )

    ) {

      return "bg-cyan-400 text-white";

    }



    return "bg-cyan-400 text-white";

  }



  function statusDot() {

    if (

      booking.status ===

      "pending"

    ) {

      return "bg-amber-400";

    }



    if (

      booking.status ===

      "checked_in"

    ) {

      return "bg-emerald-700";

    }



    if (

      booking.status ===

      "cancelled"

    ) {

      return "bg-red-700";

    }



    return "bg-red-500";

  }



  /* ======================================================

     RESIZE

  ====================================================== */



  function startResize(

    event:

      ReactPointerEvent<HTMLSpanElement>,



    side:

      ResizeSide

  ) {

    event.preventDefault();

    event.stopPropagation();



    const startX =

      event.clientX;



    onResizeStart(

      booking.id

    );



    function pointerUp(

      pointerEvent:

        PointerEvent

    ) {

      cleanup();



      const deltaX =

        pointerEvent.clientX -

        startX;



      const dayDelta =

        Math.round(

          deltaX /

            CELL_WIDTH

        );



      onResizeEnd();



      void onResize({

        booking,

        side,

        dayDelta,

      });

    }



    function pointerCancel() {

      cleanup();



      onResizeEnd();

    }



    function cleanup() {

      window.removeEventListener(

        "pointerup",

        pointerUp

      );



      window.removeEventListener(

        "pointercancel",

        pointerCancel

      );

    }



    window.addEventListener(

      "pointerup",

      pointerUp

    );



    window.addEventListener(

      "pointercancel",

      pointerCancel

    );

  }



  return (

    <button

      ref={

        setNodeRef

      }



      {...listeners}

      {...attributes}



      type="button"



      onClick={() => {

        if (

          activeDragging ||

          isDragging ||

          activeResizing

        ) {

          return;

        }



        onOpen();

      }}



      style={{

        position:

          "absolute",



        left,



        width,



        top:

          5,



        height:

          27,



        transform:

          transformStyle,



        zIndex:

          isDragging ||

          activeResizing

            ? 60

            : 10,



        touchAction:

          "none",



        clipPath:

          "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)",

      }}



      className={`

        group

        cursor-grab

        overflow-visible

        px-3

        text-left

        text-[10px]

        font-semibold

        shadow-sm



        ${bookingStyle()}



        ${

          isDragging

            ? "opacity-70 ring-2 ring-blue-500"

            : ""

        }

      `}

    >

      {/* LEFT HANDLE */}



      <span

        onPointerDown={(

          event

        ) =>

          startResize(

            event,

            "left"

          )

        }

        className="absolute bottom-0 left-0 top-0 z-20 w-[7px] cursor-ew-resize opacity-0 group-hover:opacity-100"

      />



      {/* NAME */}



      <span className="block truncate leading-[27px]">

        {

          booking.guestName

        }

      </span>



      {/* STATUS DOT */}



      <span

        className={`absolute right-[3px] top-[-4px] h-[7px] w-[7px] rounded-full border border-white ${statusDot()}`}

      />



      {/* RIGHT HANDLE */}



      <span

        onPointerDown={(

          event

        ) =>

          startResize(

            event,

            "right"

          )

        }

        className="absolute bottom-0 right-0 top-0 z-20 w-[7px] cursor-ew-resize opacity-0 group-hover:opacity-100"

      />

    </button>

  );

}