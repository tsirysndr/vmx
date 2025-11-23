function List() {
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
          <th>Ports</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>famous-hose</td>
          <td>8</td>
          <td>2GB</td>
          <td className="text-[#7033ff]!">RUNNING</td>
          <td>44288</td>
          <td>coreos-disk.qcow2</td>
          <td>{"2222->22"}</td>
          <td>5 days ago</td>
        </tr>
        <tr>
          <td>proud-rose</td>
          <td>8</td>
          <td>2GB</td>
          <td className="text-[#b4b2b2]!">Exited 4 days ago</td>
          <td>56476</td>
          <td>nixos-disk.img</td>
          <td>{"2222->22"}</td>
          <td>4 days ago</td>
        </tr>
      </tbody>
    </table>
  );
}

export default List;
