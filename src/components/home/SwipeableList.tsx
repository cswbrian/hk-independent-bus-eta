import React, {
  useContext,
  useMemo,
  useRef,
  useImperativeHandle,
  useState,
  useEffect,
  useCallback,
} from "react";
import SwipeableViews from "react-swipeable-views";
import { Box, List, Typography } from "@mui/material";
import {
  Location,
  RouteList,
  StopListEntry,
  StopList,
  EtaDb,
} from "hk-bus-eta";

import AppContext from "../../AppContext";
import { isHoliday, isRouteAvaliable } from "../../timetable";
import { coToType, getDistance } from "../../utils";
import SuccinctTimeReport from "./SuccinctTimeReport";
import type { HomeTabType } from "./HomeTabbar";
import { useTranslation } from "react-i18next";
import { CircularProgress } from "../Progress";
import { RouteCollection, TransportType } from "../../typing";
import HomeRouteListDropDown from "./HomeRouteList";

interface SwipeableListProps {
  geolocation: Location;
  homeTab: HomeTabType;
  onChangeTab: (v: string) => void;
}

interface SwipeableListRef {
  changeTab: (v: HomeTabType) => void;
}

interface SelectedRoutes {
  saved: string;
  nearby: Partial<Record<TransportType, string>>;
  smartCollections: Array<{
    name: string;
    routes: string;
    defaultExpanded: boolean;
  }>;
  collections: string[];
}

const SwipeableList = React.forwardRef<SwipeableListRef, SwipeableListProps>(
  ({ geolocation, homeTab, onChangeTab }, ref) => {
    const {
      savedEtas,
      db: { holidays, routeList, stopList, serviceDayMap },
      isRouteFilter,
      collections,
    } = useContext(AppContext);
    const isTodayHoliday = useMemo(
      () => isHoliday(holidays, new Date()),
      [holidays]
    );
    const defaultHometab = useRef(homeTab);
    const { t } = useTranslation();
    const [selectedRoutes, setSelectedRoutes] = useState<SelectedRoutes | null>(
      null
    );

    useImperativeHandle(ref, () => ({
      changeTab: (v) => {
        defaultHometab.current = v;
      },
    }));

    useEffect(() => {
      setSelectedRoutes(
        getSelectedRoutes({
          geolocation,
          savedEtas,
          collections,
          routeList,
          stopList,
          isRouteFilter,
          isTodayHoliday,
          serviceDayMap,
        })
      );
    }, [
      geolocation,
      savedEtas,
      collections,
      routeList,
      stopList,
      isRouteFilter,
      isTodayHoliday,
      serviceDayMap,
    ]);

    const SavedRouteList = useMemo(() => {
      if (selectedRoutes === null) {
        return <CircularProgress sx={{ my: 10 }} />;
      }
      const savedRoutes = selectedRoutes["saved"].split("|");
      const noRoutes = savedRoutes.every((routeId) => !routeId);

      return (
        <React.Fragment>
          {noRoutes ? (
            <Typography sx={{ marginTop: 5 }}>
              <b>{t("未有收藏路線")}</b>
            </Typography>
          ) : (
            <List disablePadding>
              {savedRoutes.map(
                (selectedRoute, idx) =>
                  Boolean(selectedRoute) && (
                    <SuccinctTimeReport
                      key={`route-shortcut-${idx}`}
                      routeId={selectedRoute}
                    />
                  )
              )}
            </List>
          )}
        </React.Fragment>
      );
    }, [selectedRoutes, t]);

    const NearbyRouteList = useMemo(
      () =>
        selectedRoutes?.nearby ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(selectedRoutes.nearby).map(
              ([type, nearbyRoutes]) => (
                <HomeRouteListDropDown
                  key={`nearby-${type}`}
                  name={t(type)}
                  routeStrings={nearbyRoutes}
                />
              )
            )}
          </Box>
        ) : (
          <CircularProgress sx={{ my: 10 }} />
        ),
      [selectedRoutes, t]
    );

    const SmartCollectionRouteList = useMemo(
      () =>
        selectedRoutes?.smartCollections.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {selectedRoutes.smartCollections.map(
              ({ name, routes, defaultExpanded }, idx) => (
                <HomeRouteListDropDown
                  key={`collection-${idx}`}
                  name={name}
                  routeStrings={routes}
                  defaultExpanded={defaultExpanded}
                />
              )
            )}
            {!selectedRoutes.smartCollections.reduce(
              (acc, { routes }) =>
                acc || routes.split("|").filter((v) => Boolean(v)).length > 0,
              false
            ) && (
              <Typography sx={{ marginTop: 5 }} fontWeight={700}>
                {t("未有收藏路線")}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography sx={{ marginTop: 5 }} fontWeight={700}>
            {t("未有收藏路線")}
          </Typography>
        ),
      [t, selectedRoutes]
    );

    const collectionRouteLists = useMemo(
      () =>
        collections.map((_, idx) => {
          const routes = selectedRoutes?.collections[idx].split("|") ?? [];
          const noRoutes = routes.every((routeId) => !routeId);

          return (
            <React.Fragment key={`collection-route-${idx}`}>
              {noRoutes ? (
                <Typography sx={{ marginTop: 5 }}>
                  <b>{t("收藏中未有路線")}</b>
                </Typography>
              ) : (
                <List disablePadding>
                  {routes.map(
                    (selectedRoute, idx) =>
                      Boolean(selectedRoute) && (
                        <SuccinctTimeReport
                          key={`route-shortcut-${idx}`}
                          routeId={selectedRoute}
                        />
                      )
                  )}
                </List>
              )}
            </React.Fragment>
          );
        }),
      [t, collections, selectedRoutes]
    );

    const getViewIdx = useCallback(() => {
      let ret = HOME_TAB.indexOf(defaultHometab.current);
      if (ret !== -1) return ret;
      for (let i = 0; i < collections.length; ++i) {
        if (collections[i].name === defaultHometab.current) {
          return i + HOME_TAB.length;
        }
      }
      return -1;
    }, [collections]);

    return useMemo(
      () => (
        <SwipeableViews
          index={getViewIdx()}
          onChangeIndex={(idx) => {
            onChangeTab(
              idx < HOME_TAB.length
                ? HOME_TAB[idx]
                : collections[idx - HOME_TAB.length].name
            );
          }}
        >
          {NearbyRouteList}
          {SavedRouteList}
          {SmartCollectionRouteList}
          {collectionRouteLists?.map((Collection) => Collection)}
        </SwipeableViews>
      ),
      [
        onChangeTab,
        getViewIdx,
        collections,
        SavedRouteList,
        NearbyRouteList,
        SmartCollectionRouteList,
        collectionRouteLists,
      ]
    );
  }
);

export default SwipeableList;

const HOME_TAB = ["nearby", "saved", "collections"];

const getSelectedRoutes = ({
  savedEtas,
  collections,
  geolocation,
  stopList,
  routeList,
  isRouteFilter,
  isTodayHoliday,
  serviceDayMap,
}: {
  savedEtas: string[];
  collections: RouteCollection[];
  geolocation: Location;
  stopList: StopList;
  routeList: RouteList;
  isRouteFilter: boolean;
  isTodayHoliday: boolean;
  serviceDayMap: EtaDb["serviceDayMap"];
}): SelectedRoutes => {
  const selectedRoutes = savedEtas
    .filter((routeUrl, index, self) => {
      return (
        self.indexOf(routeUrl) === index && routeUrl.split("/")[0] in routeList
      );
    })
    .map((routeUrl, idx, self): [string, number, number] => {
      const [routeId, stopIdx] = routeUrl.split("/");
      // TODO: taking the longest stop array to avoid error, should be fixed in the database
      const _stops = Object.values(routeList[routeId].stops).sort(
        (a, b) => b.length - a.length
      )[0];
      if (stopIdx !== undefined) {
        // if specified which stop
        return [
          routeUrl,
          getDistance(geolocation, stopList[_stops[stopIdx]].location),
          self.length - idx,
        ];
      } else {
        // else find the nearest stop
        const stop = _stops
          .map((stop) => [
            stop,
            getDistance(geolocation, stopList[stop].location),
          ])
          .sort(([, a], [, b]) => (a < b ? -1 : 1))[0][0];
        return [
          routeUrl,
          getDistance(geolocation, stopList[stop].location),
          self.length - idx,
        ];
      }
    });

  const nearbyRoutes = Object.entries(stopList)
    .map((stop: [string, StopListEntry]): [string, StopListEntry, number] =>
      // potentially could be optimized by other distance function
      [...stop, getDistance(stop[1].location, geolocation)]
    )
    .filter(
      (stop) =>
        // keep only nearby 1000m stops
        stop[2] < 1000
    )
    .sort((a, b) => a[2] - b[2])
    .slice(0, 20)
    .reduce(
      (acc, [stopId]) => {
        Object.entries(routeList).forEach(([key, route]) => {
          ["kmb", "lrtfeeder", "lightRail", "gmb", "ctb", "nlb"].forEach(
            (co) => {
              if (route.stops[co] && route.stops[co].includes(stopId)) {
                if (acc[coToType[co]] === undefined) acc[coToType[co]] = [];
                acc[coToType[co]].push(
                  key + "/" + route.stops[co].indexOf(stopId)
                );
              }
            }
          );
        });
        return acc;
      },
      { bus: [], mtr: [], lightRail: [], minibus: [] }
    );

  const collectionRoutes = collections.reduce(
    (acc, { name, list, schedules }) => {
      acc.push({
        name: name,
        routes: list,
        defaultExpanded: schedules.reduce((acc, { day, start, end }) => {
          if (acc) return acc;
          const curDate = new Date();
          curDate.setUTCHours(curDate.getUTCHours() + 8);
          const _day = curDate.getUTCDay();
          // skip handling timezone here
          if ((isTodayHoliday && day === 0) || day === _day) {
            let sTs = start.hour * 60 + start.minute;
            let eTs = end.hour * 60 + end.minute;
            let curTs =
              (curDate.getUTCHours() * 60 + curDate.getUTCMinutes()) % 1440;
            return sTs <= curTs && curTs <= eTs;
          }
          return false;
        }, false),
      });
      return acc;
    },
    []
  );

  const formatHandling = (routes) => {
    return routes
      .filter((v, i, s) => s.indexOf(v) === i) // uniqify
      .filter((routeUrl) => {
        const [routeId] = routeUrl.split("/");
        return (
          routeList[routeId] &&
          (!isRouteFilter ||
            isRouteAvaliable(
              routeId,
              routeList[routeId].freq,
              isTodayHoliday,
              serviceDayMap
            ))
        );
      })
      .map((routeUrl) => {
        // handling for saved route without specified stop, use the nearest one
        const [routeId, stopIdx] = routeUrl.split("/");
        if (stopIdx !== undefined) return routeUrl;
        const _stops = Object.values(routeList[routeId].stops).sort(
          (a, b) => b.length - a.length
        )[0];
        const stop = _stops
          .map((stop) => [
            stop,
            getDistance(geolocation, stopList[stop].location),
          ])
          .sort(([, a], [, b]) => (a < b ? -1 : 1))[0][0];
        return `${routeUrl}/${_stops.indexOf(stop as string)}`;
      })
      .concat(Array(40).fill("")) // padding
      .slice(0, 40)
      .join("|");
  };

  return {
    saved: formatHandling(
      selectedRoutes
        .sort((a, b) => a[2] - b[2])
        .map((v) => v[0])
        .slice(0, 40)
    ),
    nearby: Object.entries(nearbyRoutes).reduce((acc, [type, nearbyRoutes]) => {
      acc[type] = formatHandling(nearbyRoutes);
      return acc;
    }, {}),
    smartCollections: collectionRoutes.map((v) => ({
      ...v,
      routes: formatHandling(v.routes),
    })),
    collections: collections.map((colleciton) =>
      formatHandling(colleciton.list)
    ),
  };
};
