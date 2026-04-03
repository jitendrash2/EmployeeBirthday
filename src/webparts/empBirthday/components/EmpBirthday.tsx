import * as React from "react";
import styles from "./EmpBirthday.module.scss";

import { IEmpBirthdayProps } from "./IEmpBirthdayProps";
import { IBirthday } from "./IBirthday";

import BirthdayService from "../services/BirthdayService";
import CacheService from "../services/CacheService";

import { MdEmail } from "react-icons/md";
import { FaBirthdayCake, FaTrophy, FaUserPlus } from "react-icons/fa";
import { SiMicrosoftteams } from "react-icons/si";
import { FiRefreshCw } from "react-icons/fi";

import { formatBirthday } from "../helpers/BirthdayHelper";
import { formatAnniversary, formatYearsCompleted } from "../helpers/AnniversaryHelper";
import {
  formatDaysOnTeam,
  formatJoinedAgo,
  formatNewHireDate
} from "../helpers/NewHireHelper";
import {
  BackgroundVariant,
  getInitials,
  resolveBackgroundVariant
} from "../helpers/VisualHelper";
import {
  EventType,
  areAllEventTypesSelected,
  getEventSelectionKey
} from "../helpers/EventSelectionHelper";

import EventModal from "./EventModal";

interface ILoadOptions {
  forceRefresh?: boolean;
  showLoading?: boolean;
}

const themeClassNames: Record<BackgroundVariant, string> = {
  simple: styles.themeSimple,
  celebration: styles.themeCelebration,
  sunrise: styles.themeSunrise,
  meadow: styles.themeMeadow,
  royal: styles.themeRoyal
};

export default function EmpBirthday(props: IEmpBirthdayProps): React.ReactElement {

  const [events, setEvents] = React.useState<IBirthday[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = React.useState<IBirthday | null>(null);
  const loadEventsRef = React.useRef<(options?: ILoadOptions) => Promise<void>>(async () => undefined);
  const loadInProgressRef = React.useRef<boolean>(false);
  const hasEventsRef = React.useRef<boolean>(false);

  const backgroundVariant = resolveBackgroundVariant(
    props.backgroundVariant,
    props.backgroundImage
  );
  const themeClassName = themeClassNames[backgroundVariant];
  const selectedEventTypes = props.selectedEventTypes;
  const selectedEventTypesKey = getEventSelectionKey(selectedEventTypes);
  const selectedEventTypeSet = new Set<EventType>(selectedEventTypes);
  const hasBirthdays = selectedEventTypeSet.has("birthday");
  const hasAnniversaries = selectedEventTypeSet.has("anniversary");
  const hasNewHires = selectedEventTypeSet.has("newHire");
  const isNewHireMode = hasNewHires && !hasBirthdays && !hasAnniversaries;
  const isBirthdayOnlyMode = hasBirthdays && !hasAnniversaries && !hasNewHires;
  const isAnniversaryOnlyMode = hasAnniversaries && !hasBirthdays && !hasNewHires;
  const isAllMode = areAllEventTypesSelected(selectedEventTypes);
  const includesCelebrations = hasBirthdays || hasAnniversaries;

  hasEventsRef.current = events.length > 0;

  const configuredTitle = props.description?.trim();

  const webPartTitle = configuredTitle
    ? configuredTitle
    : isBirthdayOnlyMode
      ? "Employee Birthdays"
      : isAnniversaryOnlyMode
        ? "Employee Workiversaries"
        : isNewHireMode
          ? "New Team Members"
          : isAllMode
            ? "Employee Celebrations & New Hires"
            : "Employee Highlights";

  const defaultHeroSubtitle = isBirthdayOnlyMode
    ? "Celebrate upcoming birthdays across the organization."
    : isAnniversaryOnlyMode
      ? "Recognize upcoming work anniversaries across the organization."
      : isNewHireMode
        ? `Welcome teammates who joined in the last ${props.newHireDays} days.`
        : isAllMode
          ? "Celebrate upcoming birthdays, work anniversaries, and welcome new teammates."
          : "Load the employee cards you want to highlight for your team.";

  const eventFilterLabel = isBirthdayOnlyMode
    ? "Birthdays Only"
    : isAnniversaryOnlyMode
      ? "Workiversaries Only"
      : isNewHireMode
        ? "New Hires Only"
        : isAllMode
          ? "All Cards"
          : [
            hasBirthdays ? "Birthdays" : "",
            hasAnniversaries ? "Workiversaries" : "",
            hasNewHires ? "New Hires" : ""
          ].filter(Boolean).join(" + ");

  const nextEvent = events[0];

  const nextEventSummary = loading
    ? "Loading employee highlights..."
    : nextEvent
      ? isNewHireMode
        ? `Newest teammate: ${nextEvent.Title || "Team member"} ${formatJoinedAgo(nextEvent.DaysSinceHire ?? 0)}`
        : `Next up: ${nextEvent.Title || "Team member"} on ${nextEvent.IsAnniversary
          ? formatAnniversary(nextEvent.HireDate!)
          : formatBirthday(nextEvent.Birthday!)
        }`
      : isNewHireMode
        ? `No new hires in the last ${props.newHireDays} days`
        : `No upcoming events in the next ${props.daysAhead} days`;

  const heroEyebrow = props.heroEyebrowText?.trim() || eventFilterLabel;
  const heroSubtitle = props.heroSubtitleText?.trim() || defaultHeroSubtitle;
  const heroHighlight = props.heroHighlightText?.trim() || nextEventSummary;
  const rangeValue = includesCelebrations && hasNewHires
    ? `${props.daysAhead}/${props.newHireDays}`
    : isNewHireMode
      ? props.newHireDays
      : props.daysAhead;
  const rangeLabel = includesCelebrations && hasNewHires
    ? "Ahead/Lookback"
    : isNewHireMode
      ? "Last Days"
      : "Days Ahead";
  const countLabel = isNewHireMode
    ? "New Hires"
    : isAllMode
      ? "Cards"
      : "Upcoming";
  const noDataText = isNewHireMode
    ? `No new hires found in the last ${props.newHireDays} days.`
    : includesCelebrations && hasNewHires
      ? "No employee cards found for the selected filters."
      : "No upcoming events found for the selected filter.";

  const renderProfile = (event: IBirthday): React.ReactNode => {
    const photoUrl = event.PhotoUrl?.trim();

    if (photoUrl) {
      return (
        <img
          src={photoUrl}
          alt={event.Title || ""}
        />
      );
    }

    return (
      <div className={styles.profileFallback}>
        {getInitials(
          event.Title,
          event.IsNewHire ? "NH" : event.IsAnniversary ? "WA" : "HB"
        )}
      </div>
    );
  };

  const handleHorizontalWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.currentTarget.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  };

  const runLoadRequest = (request: Promise<void>, errorLabel: string): void => {
    request.catch((error) => {
      console.error(errorLabel, error);
    });
  };

  const handleRefreshClick = (): void => {
    runLoadRequest(
      loadEventsRef.current({ forceRefresh: true }),
      "Manual refresh failed."
    );
  };

  React.useEffect(() => {
    let isDisposed = false;
    const service = new BirthdayService(props.sp, props.graph);

    const applyEvents = (items: IBirthday[]): void => {
      if (isDisposed) {
        return;
      }

      setEvents(items);
      setLoading(false);
    };

    const setLoadInProgress = (isInProgress: boolean): void => {
      loadInProgressRef.current = isInProgress;
    };

    const loadData = async (options: ILoadOptions = {}): Promise<void> => {
      const {
        forceRefresh = false,
        showLoading = false
      } = options;

      if (loadInProgressRef.current) {
        return;
      }

      setLoadInProgress(true);

      if (showLoading) {
        setLoading(true);
      }

      if (forceRefresh) {
        setRefreshing(true);
      }

      try {
        const allEvents = await service.getAllEvents(
          props.listName,
          props.daysAhead,
          props.newHireDays,
          selectedEventTypes,
          {
            forceRefresh,
            onBackgroundRefresh: (backgroundEvents) => {
              applyEvents(backgroundEvents);
            }
          }
        );

        applyEvents(allEvents);
      } catch (error) {
        console.error("Failed to load employee events.", error);

        if (!isDisposed) {
          if (!hasEventsRef.current) {
            setEvents([]);
            setLoading(false);
          }
        }
      } finally {
        if (!isDisposed) {
          setRefreshing(false);
        }

        setLoadInProgress(false);
      }
    };

    loadEventsRef.current = loadData;

    runLoadRequest(
      loadData({ showLoading: true }),
      "Initial employee load failed."
    );

    const intervalId = window.setInterval(() => {
      runLoadRequest(
        loadData({
          forceRefresh: true
        }),
        "Scheduled employee refresh failed."
      );
    }, CacheService.getRefreshInterval());

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);

      if (loadEventsRef.current === loadData) {
        loadEventsRef.current = async () => undefined;
      }

      loadInProgressRef.current = false;
    };
  }, [
    props.daysAhead,
    props.graph,
    props.listName,
    props.newHireDays,
    props.sp,
    selectedEventTypesKey
  ]);

  React.useEffect(() => {
    if (!selectedEvent) {
      return;
    }

    const updatedEvent = events.find((eventItem) =>
      (eventItem.Email ?? eventItem.Title ?? "") === (selectedEvent.Email ?? selectedEvent.Title ?? "") &&
      Boolean(eventItem.IsAnniversary) === Boolean(selectedEvent.IsAnniversary) &&
      Boolean(eventItem.IsNewHire) === Boolean(selectedEvent.IsNewHire)
    );

    if (!updatedEvent) {
      setSelectedEvent(null);
      return;
    }

    if (updatedEvent !== selectedEvent) {
      setSelectedEvent(updatedEvent);
    }
  }, [events, selectedEvent]);

  const renderHeroSection = (): React.ReactNode => (
    <div className={styles.heroSection}>
      <button
        type="button"
        className={styles.refreshButton}
        onClick={handleRefreshClick}
        disabled={refreshing || loading}
      >
        <FiRefreshCw
          className={`${styles.refreshIcon} ${refreshing ? styles.refreshIconSpinning : ""}`}
        />
        {refreshing ? "Refreshing..." : "Refresh Data"}
      </button>

      <div className={styles.heroContent}>
        <div className={styles.heroEyebrow}>{heroEyebrow}</div>
        <div className={styles.webPartTitle}>{webPartTitle}</div>
        <div className={styles.webPartSubtitle}>{heroSubtitle}</div>
        <div className={styles.heroHighlight}>{heroHighlight}</div>
      </div>

      <div className={styles.heroStats}>
        <div className={styles.heroStatCard}>
          <div className={styles.heroStatValue}>{loading ? "..." : events.length}</div>
          <div className={styles.heroStatLabel}>{countLabel}</div>
        </div>

        <div className={styles.heroStatCard}>
          <div className={styles.heroStatValue}>{rangeValue}</div>
          <div className={styles.heroStatLabel}>{rangeLabel}</div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.host}>
        <div className={`${styles.webPartShell} ${themeClassName}`}>
          <div className={styles.shellPattern} />
          {renderHeroSection()}

          <div className={styles.scrollRow} onWheel={handleHorizontalWheel}>
            {[1, 2, 3].map((index) => (
              <div key={index} className={styles.cardContainer}>
                <div className={styles.cardContent}>
                  <div className={styles.shimmerBadge} />
                  <div className={styles.shimmerHeader} />
                  <div className={styles.shimmerCircle} />
                  <div className={styles.shimmerLine} />
                  <div className={styles.shimmerLineShort} />
                  <div className={styles.shimmerLineShort} />
                </div>

                <div className={styles.footerBar}>
                  <div className={styles.shimmerIcon} />
                  <div className={styles.shimmerIcon} />
                  <div className={styles.shimmerIcon} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.host}>
      <div className={`${styles.webPartShell} ${themeClassName}`}>
        <div className={styles.shellPattern} />
        {renderHeroSection()}

        <div className={styles.scrollRow} onWheel={handleHorizontalWheel}>
          {events.length === 0 && (
            <div className={styles.noData}>
              {noDataText}
            </div>
          )}

          {events.map((eventItem) => {
            const isAnniversary = Boolean(eventItem.IsAnniversary);
            const isNewHire = Boolean(eventItem.IsNewHire);
            const canContact = Boolean(eventItem.Email?.trim());
            const badgeText = isNewHire
              ? "New Hire"
              : isAnniversary
                ? "Workiversary"
                : "Birthday";
            const cardTitle = isNewHire
              ? "Welcome Aboard!"
              : isAnniversary
                ? "Happy Workiversary!"
                : "Happy Birthday!";
            const primaryDateText = isNewHire
              ? formatNewHireDate(eventItem.HireDate!)
              : isAnniversary
                ? formatAnniversary(eventItem.HireDate!)
                : formatBirthday(eventItem.Birthday!);
            const secondaryText = isNewHire
              ? formatDaysOnTeam(eventItem.DaysSinceHire ?? 0)
              : isAnniversary
                ? formatYearsCompleted(eventItem.YearsCompleted ?? 0)
                : undefined;
            const cardTypeClassName = isNewHire
              ? styles.cardNewHire
              : isAnniversary
                ? styles.cardAnniversary
                : styles.cardBirthday;
            const badgeClassName = isNewHire
              ? styles.typeBadgeNewHire
              : isAnniversary
                ? styles.typeBadgeAnniversary
                : styles.typeBadgeBirthday;
            const cardKey = `${eventItem.Email ?? eventItem.Title ?? "team-member"}-${isNewHire ? "newhire" : isAnniversary ? "anniversary" : "birthday"}`;

            return (
              <div
                key={cardKey}
                onClick={() => setSelectedEvent(eventItem)}
                className={`${styles.cardContainer} ${themeClassName} ${cardTypeClassName} ${eventItem.IsToday ? styles.todayGlow : ""}`}
              >
                <div className={styles.cardBackdrop} />

                <div className={styles.cardContent}>
                  <div className={`${styles.typeBadge} ${badgeClassName}`}>
                    {badgeText}
                  </div>

                  <div className={styles.headerText}>
                    {cardTitle}
                  </div>

                  <div className={styles.profileImageWrapper}>
                    {renderProfile(eventItem)}
                  </div>

                  <div className={styles.nameText}>{eventItem.Title}</div>
                  <div className={styles.jobTitle}>{eventItem.JobTitle || ""}</div>

                  <div className={styles.birthDate}>
                    {primaryDateText}
                  </div>

                  {secondaryText && (
                    <div className={`${styles.supportingMetric} ${isNewHire ? styles.newHireMetric : styles.anniversaryMetric}`}>
                      {secondaryText}
                    </div>
                  )}
                </div>

                <div className={styles.footerBar}>
                  <div
                    className={`${styles.iconBtn} ${!canContact ? styles.iconBtnDisabled : ""}`}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();

                      if (!canContact) {
                        return;
                      }

                      window.location.href = `mailto:${eventItem.Email}`;
                    }}
                  >
                    <MdEmail size={26} color={canContact ? "#1d4fa8" : "#9aa7bf"} />
                  </div>

                  <div
                    className={`${styles.iconBtn} ${!canContact ? styles.iconBtnDisabled : ""}`}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();

                      if (!canContact) {
                        return;
                      }

                      window.open(
                        `https://teams.microsoft.com/l/chat/0/0?users=${eventItem.Email}`,
                        "_blank"
                      );
                    }}
                  >
                    <SiMicrosoftteams size={24} color={canContact ? "#5b5fc7" : "#9aa7bf"} />
                  </div>

                  <div className={styles.iconBtn}>
                    {isNewHire ? (
                      <FaUserPlus size={24} color="#1f9d6a" />
                    ) : isAnniversary ? (
                      <FaTrophy size={26} color="#c49b00" />
                    ) : (
                      <FaBirthdayCake size={26} color="#e63946" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          backgroundVariant={backgroundVariant}
        />
      )}
    </div>
  );
}
