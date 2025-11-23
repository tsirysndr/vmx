import {
  useMachinesQuery,
  useStartMachineMutation,
  useStopMachineMutation,
} from "../../../hooks/useMachines";
import dayjs from "dayjs";
import dayjsPluginUTC from "dayjs/plugin/utc";
import dayjsPluginTimezone from "dayjs/plugin/timezone";
import dayjsRelativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(dayjsPluginUTC);
dayjs.extend(dayjsPluginTimezone);
dayjs.extend(dayjsRelativeTime);

function List() {
  const { mutate: startMachine } = useStartMachineMutation();
  const { mutate: stopMachine } = useStopMachineMutation();
  useStopMachineMutation();
  const { data, isLoading } = useMachinesQuery();
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>vCPU</th>
          <th>Memory</th>
          <th>Status</th>
          <th>PID</th>
          <th>Image</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr>
            <td colSpan={8}>Loading...</td>
          </tr>
        ) : (
          data?.map((machine) => (
            <tr key={machine.id}>
              <td>{machine.name}</td>
              <td>{machine.cpus}</td>
              <td>{machine.memory}</td>
              <td
                style={{
                  color: machine.status === "RUNNING" ? "#7033ff" : "#b4b2b2",
                }}
              >
                <button
                  className="mr-2"
                  onClick={() => {
                    if (machine.status === "RUNNING") {
                      stopMachine(machine.id);
                      return;
                    }
                    startMachine(machine.id);
                  }}
                >
                  {machine.status === "RUNNING" ? (
                    <span className="icon-[tabler--player-stop-filled] size-3"></span>
                  ) : (
                    <span className="icon-[tabler--player-play-filled] size-3"></span>
                  )}
                </button>
                {machine.status}
              </td>
              <td>{machine.pid}</td>
              <td>
                {machine.drivePath?.split("/")?.pop()?.slice(0, 18)}
                {(machine.drivePath?.split("/")?.pop()?.length || 0) > 19
                  ? "..."
                  : ""}
              </td>
              <td>{dayjs.utc(machine.createdAt).fromNow()}</td>
            </tr>
          ))
        )}
        {!isLoading && !data && (
          <tr>
            <td colSpan={8}>No machines found</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export default List;
