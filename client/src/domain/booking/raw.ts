// Shapes from the booking API, as served (see server/README.md). Providers
// enter this data by hand, so any field may be missing, the wrong type, or
// in an unexpected format: `timezone` especially.

export interface RawConsultation {
  startTime?: unknown
  endTime?: unknown
  durationInMinutes?: unknown
  bufferInMinutes?: unknown
}

export interface RawSpecialist {
  id?: unknown
  name?: unknown
  speciality?: unknown
  consultation?: RawConsultation | null
}

export interface RawBookingProvider {
  id?: unknown
  name?: unknown
  country?: unknown
  /** Free text: IANA names, offsets in several formats, Windows names or "" */
  timezone?: unknown
  /** Keyed by day name; a missing day means closed */
  daySchedules?: unknown
  specialists?: unknown
}

export interface RawAvailabilityDay {
  date?: unknown
  status?: unknown
  availableStartTimes?: unknown
  reason?: unknown
  opensAt?: unknown
  closesAt?: unknown
}

export interface RawSlot {
  startTime?: unknown
  endTime?: unknown
  isBooked?: unknown
}

export interface RawBooking {
  bookingId?: unknown
  providerId?: unknown
  specialistId?: unknown
  date?: unknown
  startTime?: unknown
  numberOfPeople?: unknown
}
